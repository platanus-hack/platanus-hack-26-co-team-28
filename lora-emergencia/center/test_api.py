import http.client
import json
import tempfile
import threading
import time
import unittest
from pathlib import Path

import center
import offline_map
from api import ApiError, CommandApi
from command_core import CenterStore, RadioFrame
from test_offline_map import create_mbtiles


class FakeGateway:
    connected = True

    def __init__(self):
        self.frames = []

    def send_reliable(self, frame):
        self.frames.append(frame)
        return True, "DELIVERED"

    def send_broadcast(self, frame):
        self.frames.append(frame)
        return True


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.store = CenterStore(":memory:")
        self.gateway = FakeGateway()
        self.api = CommandApi(self.store, self.gateway)
        self.store.ingest(RadioFrame.parse(
            "CIVIL1|CENTRO|SOS|7|MEDICO|2|4.1|-74.1|Centro|persona inconsciente"
        ), "-70", "8")
        self.store.ingest(RadioFrame.parse("MEDICO01|CENTRO|HB|1|MEDICO|CENTRO"), "-60", "9")

    def tearDown(self):
        self.store.close()

    def test_request_filters_are_validated_and_triage_is_computed(self):
        result = self.api.get(
            "/api/v1/requests", {"category": ["MEDICO"], "priority": ["2"], "q": ["inconsciente"]}
        )

        self.assertEqual(result["count"], 1)
        self.assertEqual(result["items"][0]["triage"]["priority"], 0)
        with self.assertRaises(ApiError):
            self.api.get("/api/v1/requests", {"state": ["UNKNOWN"]})

    def test_overview_and_dynamic_routes_return_expected_contracts(self):
        request_id = self.store.list_requests()[0]["id"]

        overview = self.api.get("/api/v1/overview", {})

        self.assertIn("metrics", overview)
        self.assertIsNone(overview["center_position"])
        self.assertEqual(overview["requests"][0]["id"], request_id)
        self.assertIn("safe_people", overview)

    def test_overview_includes_recent_safe_people_details(self):
        self.store.ingest(RadioFrame.parse(
            "CIVIL2|CENTRO|OK|8|Jhomar|CC7435|4.65|-74.10|Portal norte"
        ), "-62", "9")

        person = self.api.overview()["safe_people"][0]

        self.assertEqual(person["name"], "Jhomar")
        self.assertEqual(person["document"], "CC7435")
        self.assertEqual(person["lat"], "4.65")
        self.assertEqual(person["place"], "Portal norte")

    def test_overview_exposes_configured_center_position(self):
        position = {
            "lat": 4.6767, "lon": -74.0483,
            "source": "CONFIGURADA", "label": "Centro de comando",
        }
        api = CommandApi(self.store, self.gateway, center_position=position)

        self.assertEqual(api.get("/api/v1/overview", {})["center_position"], position)
        with self.assertRaises(ApiError) as context:
            self.api.get("/api/v1/requests/not-a-number", {})
        self.assertEqual(context.exception.status, 400)
        with self.assertRaises(ApiError) as context:
            self.api.get("/api/v1/resources/MISSING", {})
        self.assertEqual(context.exception.status, 404)

    def test_center_position_is_validated_and_persisted(self):
        saved = self.api.post("/api/v1/center-position", {
            "lat": 4.6501, "lon": -74.1012, "accuracy": 35.5,
            "source": "NAVEGADOR",
        })

        self.assertEqual(saved["source"], "NAVEGADOR")
        self.assertEqual(saved["accuracy"], 35.5)
        self.assertEqual(self.store.get_center_position(), saved)
        self.assertEqual(self.api.overview()["center_position"], saved)
        with self.assertRaises(ApiError):
            self.api.post("/api/v1/center-position", {
                "lat": 95, "lon": -74, "source": "MANUAL",
            })
        with self.assertRaises(ApiError):
            self.api.post("/api/v1/center-position", {
                "lat": 4, "lon": -74, "source": "IP",
            })

    def test_operational_read_models_and_broadcast_receipts(self):
        request_id = self.store.list_requests()[0]["id"]
        broadcast = self.api.post(
            "/api/v1/broadcasts",
            {"message": "Evacuar", "scope": "ALL", "priority": "URGENT", "expires_in": 300},
        )
        self.store.ingest(RadioFrame.parse(
            "MEDICO01|CENTRO|BCA|3|{}".format(broadcast["message_id"])
        ))
        self.store.ingest(RadioFrame.parse("CIVIL2|CENTRO|OK|2|Maria|CC1|4.1|-74.1|Centro"))

        self.assertEqual(self.api.get("/api/v1/requests/{}".format(request_id), {})["id"], request_id)
        self.assertEqual(len(self.api.get("/api/v1/resources", {})["items"]), 1)
        self.assertEqual(self.api.get("/api/v1/resources/MEDICO01", {})["kind"], "MEDICO")
        self.assertTrue(self.api.get("/api/v1/network", {})["gateway"]["connected"])
        self.assertGreater(len(self.api.get("/api/v1/radio-events", {})["items"]), 0)
        self.assertEqual(len(self.api.get("/api/v1/broadcasts", {})["items"]), 1)
        self.assertEqual(
            self.api.get("/api/v1/broadcasts/{}".format(broadcast["message_id"]), {})["received_count"], 1
        )
        self.assertEqual(self.api.get("/api/v1/safe-people", {"q": ["Maria"]})["items"][0]["name"], "Maria")

    def test_resources_collection_honors_and_validates_limits(self):
        self.store.ingest(RadioFrame.parse("RESCATE01|CENTRO|HB|2|RESCATE|NORTE"), "-60", "9")

        result = self.api.get("/api/v1/resources", {"limit": ["1"]})

        self.assertEqual(len(result["items"]), 1)
        with self.assertRaises(ApiError) as context:
            self.api.get("/api/v1/resources", {"limit": ["0"]})
        self.assertEqual(context.exception.status, 400)

    def test_dispatch_records_timeline_and_transmits_effective_priority(self):
        request_id = self.store.list_requests()[0]["id"]

        result = self.api.post(
            "/api/v1/requests/{}/dispatch".format(request_id),
            {"resource_node": "MEDICO01", "actor": "Ana", "reason": "Revisión completa"},
        )
        timeline = self.api.get(
            "/api/v1/requests/{}/timeline".format(request_id), {}
        )["items"]

        self.assertEqual(result["effective_priority"], 0)
        self.assertEqual(self.gateway.frames[0].payload[6], "0")
        self.assertEqual(timeline[-1]["event_type"], "DISPATCHED")
        self.assertEqual(timeline[-1]["actor"], "Ana")

    def test_human_actions_require_valid_transitions_and_are_audited(self):
        request_id = self.store.list_requests()[0]["id"]

        result = self.api.post(
            "/api/v1/requests/{}/actions".format(request_id),
            {"action": "review", "actor": "Luis", "reason": "Validar ubicación"},
        )

        self.assertEqual(result["request"]["state"], "EN_REVISION")
        self.assertEqual(self.store.request_timeline(request_id)[-1]["event_type"], "HUMAN_REVIEW")
        self.gateway.send_reliable = lambda _frame: (False, "UNCONFIRMED")
        with self.assertRaises(ApiError):
            self.api.post(
                "/api/v1/requests/{}/dispatch".format(request_id),
                {"resource_node": "MEDICO01", "actor": "Luis", "reason": "Intento revisado"},
            )
        self.assertEqual(self.store.get_request(request_id)["state"], "EN_REVISION")
        with self.assertRaises(ApiError) as context:
            self.api.post(
                "/api/v1/requests/{}/actions".format(request_id),
                {"action": "resolve", "actor": "Luis", "reason": "No corresponde"},
            )
        self.assertEqual(context.exception.status, 409)

    def test_reviewed_request_keeps_candidates_and_can_be_dispatched(self):
        request_id = self.store.list_requests()[0]["id"]
        self.api.post(
            "/api/v1/requests/{}/actions".format(request_id),
            {"action": "review", "actor": "Luis", "reason": "Validar ubicación"},
        )

        request = self.api.get("/api/v1/requests/{}".format(request_id), {})
        self.assertEqual(request["triage"]["recommended_resource"]["node"], "MEDICO01")
        self.api.post(
            "/api/v1/requests/{}/dispatch".format(request_id),
            {"resource_node": "MEDICO01", "actor": "Luis", "reason": "Validado"},
        )
        self.assertEqual(self.store.get_request(request_id)["state"], "DESPACHADA")

    def test_overview_triages_all_open_requests_before_limiting_queue(self):
        now = time.time()
        with self.store._db:
            for index in range(101):
                self.store._db.execute(
                    "INSERT INTO requests(node,seq,category,priority,detail,created_at,updated_at) "
                    "VALUES(?,?,?,?,?,?,?)",
                    ("N{}".format(index), index + 100, "AGUA", 1, "normal", now + index, now),
                )
            self.store._db.execute(
                "INSERT INTO requests(node,seq,category,priority,detail,created_at,updated_at) "
                "VALUES('ESCALADA',999,'MEDICO',3,'persona inconsciente',?,?)",
                (now + 1000, now + 1000),
            )

        overview = self.api.get("/api/v1/overview", {})

        self.assertEqual(overview["metrics"]["open_requests"], 103)
        self.assertEqual(overview["metrics"]["critical"], 2)
        self.assertIn("ESCALADA", [item["node"] for item in overview["requests"]])

    def test_broadcast_exists_while_transmitting_and_failed_attempt_is_kept(self):
        observed = []

        def send_with_receipt(frame):
            observed.append(self.store.get_broadcast(frame.message_id)["status"])
            result = self.store.ingest(RadioFrame.parse(
                "MEDICO01|CENTRO|BCA|9|{}".format(frame.message_id)
            ))
            observed.append(result)
            return False

        self.gateway.send_broadcast = send_with_receipt
        with self.assertRaises(ApiError):
            self.api.post(
                "/api/v1/broadcasts",
                {"message": "Evacuar", "scope": "ALL", "priority": "URGENT", "expires_in": 300},
            )

        item = self.store.list_broadcasts()[0]
        self.assertEqual(observed, ["SENDING", "UPDATED"])
        self.assertEqual(item["status"], "FAILED")
        self.assertEqual(item["received_count"], 1)
        self.assertEqual(self.store.list_radio_events(direction="OUT")[0]["result"], "FAILED")

    def test_simulator_is_hidden_outside_demo_and_uses_ingest_in_demo(self):
        with self.assertRaises(ApiError) as context:
            self.api.post("/api/v1/simulator/frames", {"frame": "NODE|CENTRO|OK|1|A|B||||"})
        self.assertEqual(context.exception.status, 404)

        demo_api = CommandApi(self.store, self.gateway, demo=True)
        result = demo_api.post(
            "/api/v1/simulator/frames",
            {"frame": "SIM|CENTRO|OK|2|Maria|CC1|4.1|-74.1|Centro"},
        )
        self.assertEqual(result["results"][0]["result"], "CREATED")
        self.assertEqual(self.store.list_safe_people()[0]["name"], "Maria")

    def test_demo_scenarios_reject_unknown_values_and_ingest_valid_frames(self):
        demo_api = CommandApi(self.store, self.gateway, demo=True)

        result = demo_api.post("/api/v1/simulator/scenarios", {"scenario": "rescue"})

        self.assertEqual(result["results"][0]["result"], "CREATED")
        with self.assertRaises(ApiError) as context:
            demo_api.post("/api/v1/simulator/scenarios", {"scenario": "unknown"})
        self.assertEqual(context.exception.status, 400)


class MigrationTests(unittest.TestCase):
    def test_request_events_migration_is_idempotent(self):
        with tempfile.TemporaryDirectory() as directory:
            path = str(Path(directory) / "center.db")
            store = CenterStore(path)
            with store._db:
                store._db.execute("DROP TABLE request_events")
            store.close()

            store = CenterStore(path)
            store._init_schema()
            columns = [row[1] for row in store._db.execute("PRAGMA table_info(request_events)")]
            store.close()

        self.assertIn("metadata_json", columns)
        self.assertIn("created_at", columns)

    def test_indexes_and_broadcast_status_migrate_idempotently(self):
        store = CenterStore(":memory:")
        store._init_schema()
        indexes = {row[1] for row in store._db.execute("PRAGMA index_list(requests)")}
        radio_indexes = {row[1] for row in store._db.execute("PRAGMA index_list(radio_events)")}
        columns = {row[1] for row in store._db.execute("PRAGMA table_info(broadcasts)")}
        store.close()

        self.assertIn("requests_priority_created_at", indexes)
        self.assertIn("radio_events_created_at_id", radio_indexes)
        self.assertIn("status", columns)


class HttpSafetyTests(unittest.TestCase):
    def setUp(self):
        self.map_directory = tempfile.TemporaryDirectory()
        self.previous_map_manager = center.MAP_MANAGER
        center.MAP_MANAGER = offline_map.MapManager(
            Path(self.map_directory.name) / "bogota.mbtiles",
            Path(self.map_directory.name) / "source.mbtiles",
        )
        self.store = CenterStore(":memory:")
        self.gateway = FakeGateway()
        center.STORE = self.store
        center.GATEWAY = self.gateway
        center.API = CommandApi(self.store, self.gateway, demo=False)
        center.API_TOKEN = ""
        self.server = center.CommandServer(("127.0.0.1", 0), center.Handler)
        self.worker = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.worker.start()
        self.connection = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=2)

    def tearDown(self):
        self.connection.close()
        self.server.shutdown()
        self.server.server_close()
        self.worker.join(2)
        self.store.close()
        center.MAP_MANAGER = self.previous_map_manager
        self.map_directory.cleanup()

    def request(self, method, path, body=None, headers=None):
        self.connection.request(method, path, body=body, headers=headers or {})
        response = self.connection.getresponse()
        payload = response.read()
        return response.status, response.getheader("Content-Type"), payload

    def test_invalid_json_and_content_type_are_rejected(self):
        status, _content_type, body = self.request(
            "POST", "/api/v1/broadcasts", "{bad", {"Content-Type": "application/json"}
        )
        self.assertEqual(status, 400)
        self.assertIn("JSON inválido", body.decode())

        status, _content_type, _body = self.request("POST", "/api/v1/broadcasts", "{}")
        self.assertEqual(status, 415)

        status, _content_type, _body = self.request(
            "POST", "/api/v1/broadcasts", "[]", {"Content-Type": "application/json"}
        )
        self.assertEqual(status, 400)

    def test_oversized_json_body_is_rejected_before_reading_it(self):
        status, _content_type, _body = self.request(
            "POST", "/api/v1/broadcasts", b"", {"Content-Type": "application/json", "Content-Length": "16385"}
        )

        self.assertEqual(status, 413)

    def test_static_files_are_explicit_and_path_traversal_is_rejected(self):
        status, content_type, _body = self.request("GET", "/styles.css")
        self.assertEqual(status, 200)
        self.assertTrue(content_type.startswith("text/css"))

        status, _content_type, body = self.request("GET", "/..%2Fcommand_core.py")
        self.assertEqual(status, 404)

        status, content_type, _body = self.request("GET", "/theme.js")
        self.assertEqual(status, 200)
        self.assertTrue(content_type.startswith("text/javascript"))
        self.assertNotIn(b"sqlite3", body)

        status, _content_type, _body = self.request("GET", "/web/app.js")
        self.assertEqual(status, 404)

    def test_local_leaflet_assets_are_served_from_explicit_allowlist(self):
        expected = {
            "/vendor/leaflet-1.9.4.css": "text/css",
            "/vendor/leaflet-1.9.4.js": "text/javascript",
            "/vendor/leaflet-vectorgrid-1.3.0.js": "text/javascript",
            "/vendor/LEAFLET-LICENSE.txt": "text/plain",
            "/vendor/LEAFLET-VECTORGRID-LICENSE.txt": "text/plain",
        }
        for path, expected_type in expected.items():
            status, content_type, body = self.request("GET", path)
            self.assertEqual(status, 200)
            self.assertTrue(content_type.startswith(expected_type))
            self.assertGreater(len(body), 100)

        status, _content_type, _body = self.request("GET", "/vendor/unknown.js")
        self.assertEqual(status, 404)

    def test_static_files_support_etag_and_security_headers(self):
        self.connection.request("GET", "/app.js")
        response = self.connection.getresponse()
        response.read()
        etag = response.getheader("ETag")
        self.assertTrue(etag)
        self.assertEqual(response.getheader("X-Frame-Options"), "DENY")
        self.connection.request("GET", "/app.js", headers={"If-None-Match": etag})
        response = self.connection.getresponse()
        response.read()
        self.assertEqual(response.status, 304)

    def test_only_versioned_vendor_assets_are_immutable(self):
        for path in ("/vendor/leaflet-1.9.4.css", "/vendor/leaflet-1.9.4.js", "/vendor/leaflet-vectorgrid-1.3.0.js"):
            self.connection.request("GET", path)
            response = self.connection.getresponse()
            response.read()
            self.assertEqual(response.getheader("Cache-Control"), "public, max-age=31536000, immutable")

        for path in ("/", "/theme.js", "/app.js", "/styles.css", "/vendor/LEAFLET-LICENSE.txt", "/vendor/LEAFLET-VECTORGRID-LICENSE.txt"):
            self.connection.request("GET", path)
            response = self.connection.getresponse()
            response.read()
            self.assertEqual(response.getheader("Cache-Control"), "no-cache")

    def test_command_center_theme_is_manual_persistent_and_loaded_early(self):
        index = (center.WEB_ROOT / "index.html").read_text(encoding="utf-8")
        theme = (center.WEB_ROOT / "theme.js").read_text(encoding="utf-8")
        app = (center.WEB_ROOT / "app.js").read_text(encoding="utf-8")
        styles = (center.WEB_ROOT / "styles.css").read_text(encoding="utf-8")

        self.assertLess(index.index('src="/theme.js"'), index.index('href="/styles.css"'))
        self.assertIn('id="theme-toggle"', index)
        self.assertIn('aria-pressed="false"', index)
        self.assertIn('localStorage.getItem(storageKey)', theme)
        self.assertIn('localStorage.setItem(storageKey, nextTheme)', theme)
        self.assertIn('colorScheme.content = nextTheme', theme)
        self.assertNotIn("prefers-color-scheme", index + theme + styles + app)
        self.assertIn(':root[data-theme="dark"]', styles)
        self.assertEqual(app.count("const SHORTBREAD_LIGHT_COLORS = {"), 1)
        self.assertEqual(app.count("const SHORTBREAD_DARK_COLORS = {"), 1)
        self.assertIn("let shortbreadColors =", app)
        self.assertIn("shortbreadColors = theme === \"dark\"", app)
        self.assertIn('hybridMap.localLayer?.redraw()', app)
        self.assertLess(app.index("const SHORTBREAD_LIGHT_COLORS"), app.index("function shortbreadStyle"))
        theme_update = app.index('shortbreadColors = theme === "dark"')
        self.assertLess(theme_update, app.index("hybridMap.localLayer?.redraw()", theme_update))

    def test_leaflet_assets_negotiate_precompressed_gzip_with_representation_etags(self):
        path = "/vendor/leaflet-1.9.4.js"
        self.connection.request("GET", path)
        identity = self.connection.getresponse()
        identity_body = identity.read()
        identity_etag = identity.getheader("ETag")

        self.connection.request("GET", path, headers={"Accept-Encoding": "gzip"})
        compressed = self.connection.getresponse()
        compressed_body = compressed.read()
        compressed_etag = compressed.getheader("ETag")

        self.assertIsNone(identity.getheader("Content-Encoding"))
        self.assertEqual(identity.getheader("Vary"), "Accept-Encoding")
        self.assertEqual(compressed.getheader("Content-Encoding"), "gzip")
        self.assertEqual(compressed.getheader("Vary"), "Accept-Encoding")
        self.assertNotEqual(identity_etag, compressed_etag)
        self.assertLess(len(compressed_body), len(identity_body))

        self.connection.request("GET", path, headers={"Accept-Encoding": "gzip;q=0"})
        not_acceptable = self.connection.getresponse()
        not_acceptable.read()
        self.assertIsNone(not_acceptable.getheader("Content-Encoding"))

        self.connection.request(
            "GET", path, headers={"Accept-Encoding": "gzip", "If-None-Match": compressed_etag}
        )
        cached = self.connection.getresponse()
        cached.read()
        self.assertEqual(cached.status, 304)
        self.assertEqual(cached.getheader("ETag"), compressed_etag)
        self.assertEqual(cached.getheader("Content-Encoding"), "gzip")
        self.assertEqual(cached.getheader("Vary"), "Accept-Encoding")

    def test_csp_allows_only_the_osm_tile_host_for_remote_images(self):
        self.connection.request("GET", "/")
        response = self.connection.getresponse()
        response.read()
        csp = response.getheader("Content-Security-Policy")
        self.assertEqual(
            csp,
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; "
            "img-src 'self' data: https://tile.openstreetmap.org; object-src 'none'; base-uri 'none'; "
            "frame-ancestors 'none'",
        )

    def test_map_frontend_has_no_remote_dependency_or_custom_tile_cache(self):
        index = (center.WEB_ROOT / "index.html").read_text(encoding="utf-8")
        app = (center.WEB_ROOT / "app.js").read_text(encoding="utf-8")
        leaflet = (center.WEB_ROOT / "vendor" / "leaflet.js").read_text(encoding="utf-8")

        self.assertIn("Leaflet 1.9.4", leaflet)
        self.assertIn('href="/vendor/leaflet-1.9.4.css"', index)
        self.assertIn('src="/vendor/leaflet-1.9.4.js" defer', index)
        self.assertIn('src="/vendor/leaflet-vectorgrid-1.3.0.js" defer', index)
        self.assertNotIn("cdn", index.lower())
        self.assertEqual(app.count("https://"), 1)
        self.assertIn('window.L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png"', app)
        self.assertIn("Activar cartografía online", app)
        self.assertIn("comparte el área visible con OpenStreetMap", app)
        self.assertIn('sessionStorage.setItem("onlineMapConsent", "true")', app)
        self.assertIn('sessionStorage.removeItem("onlineMapConsent")', app)
        self.assertNotIn("navigator.onLine", app)
        self.assertLess(app.index("sessionStorage.setItem(\"onlineMapConsent\", \"true\")"), app.index("window.L.tileLayer"))
        for forbidden in ("serviceWorker", "CacheStorage", "caches.", "prefetch"):
            self.assertNotIn(forbidden, app + index)

    def test_map_status_requires_auth_and_does_not_expose_paths(self):
        center.API_TOKEN = "secret-token"

        status, _content_type, _body = self.request("GET", "/api/v1/map")
        self.assertEqual(status, 401)

        status, content_type, body = self.request(
            "GET", "/api/v1/map", headers={"Authorization": "Bearer secret-token"}
        )
        payload = json.loads(body)

        self.assertEqual(status, 200)
        self.assertTrue(content_type.startswith("application/json"))
        self.assertFalse(payload["available"])
        self.assertIsNone(payload["generation"])
        self.assertEqual(payload["bounds"], [-74.25, 4.45, -73.95, 4.85])
        self.assertNotIn(self.map_directory.name, body.decode())

    def test_map_download_requires_auth_and_allows_one_background_task(self):
        started = threading.Event()
        release = threading.Event()

        def prepare(output, _source, progress):
            started.set()
            progress("downloading", 1, 2)
            release.wait(2)
            create_mbtiles(output, bogota_metadata=True)

        center.MAP_MANAGER = offline_map.MapManager(
            Path(self.map_directory.name) / "bogota.mbtiles",
            Path(self.map_directory.name) / "source.mbtiles",
            prepare,
        )
        center.API_TOKEN = "secret-token"
        body = json.dumps({})
        headers = {"Content-Type": "application/json"}
        status, _content_type, _body = self.request("POST", "/api/v1/map/download", body, headers)
        self.assertEqual(status, 401)

        headers["Authorization"] = "Bearer secret-token"
        status, _content_type, _body = self.request("POST", "/api/v1/map/download", body, headers)
        self.assertEqual(status, 202)
        self.assertTrue(started.wait(1))
        status, _content_type, _body = self.request("POST", "/api/v1/map/download", body, headers)
        self.assertEqual(status, 409)
        release.set()

    def test_vector_tile_headers_gzip_cache_etag_and_validation(self):
        map_path = Path(self.map_directory.name) / "bogota.mbtiles"
        create_mbtiles(map_path, bogota_metadata=True)
        center.MAP_MANAGER = offline_map.MapManager(map_path)
        map_status = center.MAP_MANAGER.status()
        zoom = 14
        x = offline_map.lon_to_tile_x(-74.05, zoom)
        y = offline_map.lat_to_tile_y(4.67, zoom)
        path = "/map/tiles/{}/{}/{}.pbf?v={}".format(zoom, x, y, map_status["generation"])

        self.connection.request("GET", path)
        response = self.connection.getresponse()
        tile = response.read()
        etag = response.getheader("ETag")
        self.assertEqual(response.status, 200)
        self.assertEqual(response.getheader("Content-Type"), "application/vnd.mapbox-vector-tile")
        self.assertEqual(response.getheader("Content-Encoding"), "gzip")
        self.assertEqual(response.getheader("Cache-Control"), "public, max-age=31536000, immutable")
        self.assertEqual(tile, b"\x1f\x8btest")
        self.connection.request("GET", path, headers={"If-None-Match": etag})
        cached = self.connection.getresponse()
        cached.read()
        self.assertEqual(cached.status, 304)

        for invalid in (
            "/map/tiles/10/0/0.pbf", "/map/tiles/15/9642/15956.pbf", "/map/tiles/14/-1/0.pbf",
            "/map/tiles/14/999999/0.pbf", "/map/tiles/14/1/..%2Fcenter.py.pbf",
        ):
            status, _content_type, _body = self.request("GET", invalid)
            self.assertEqual(status, 404)

    def test_vector_tile_is_unavailable_without_package(self):
        status, _content_type, body = self.request("GET", "/map/tiles/14/4821/7978.pbf")
        self.assertEqual(status, 404)
        self.assertNotIn(b"Traceback", body)

    def test_map_refresh_lifecycle_contracts_are_bounded_and_coalesced(self):
        app = (center.WEB_ROOT / "app.js").read_text(encoding="utf-8")
        styles = (center.WEB_ROOT / "styles.css").read_text(encoding="utf-8")

        self.assertIn("mapItemVisualSignature", app)
        self.assertIn("mapItemContentSignature", app)
        self.assertIn("markerFreshness(item)", app)
        self.assertIn("if (fitMapPoints())", app)
        self.assertIn("initialFitDone", app)
        self.assertIn('setTimeout(flushSseRefresh, 350)', app)
        self.assertIn('eventSource.addEventListener("update", scheduleSseRefresh)', app)
        self.assertIn("eventSource?.close()", app)
        self.assertIn("maxNativeZoom: state.offlineMap.maxNativeZoom", app)
        self.assertIn("maxZoom: state.offlineMap.maxzoom", app)
        self.assertIn("previousTiles !== state.offlineMap.tiles", app)
        self.assertIn("animation: resource-breathe 800ms ease-in-out 3", styles)
        self.assertIn("animation: critical-pulse 800ms var(--ease-out) 3", styles)
        self.assertNotIn("resource-breathe 2.4s ease-in-out infinite", styles)

    def test_installed_map_is_operational_and_request_markers_have_details(self):
        app = (center.WEB_ROOT / "app.js").read_text(encoding="utf-8")
        styles = (center.WEB_ROOT / "styles.css").read_text(encoding="utf-8")

        self.assertIn('panel?.classList.toggle("map-installed", map.available)', app)
        self.assertIn('marker.bindPopup(mapPopup(item)', app)
        self.assertIn("map-popup-open-request", app)
        self.assertIn("item.rssi || \"Sin dato\"", app)
        self.assertIn("item.snr || \"Sin dato\"", app)
        self.assertIn(".map-panel.map-installed .map-toolbar", styles)
        self.assertIn(".map-panel.map-installed .panel-actions", styles)

    def test_simulator_http_guard_returns_not_found(self):
        status, _content_type, _body = self.request(
            "POST", "/api/v1/simulator/scenarios", json.dumps({"scenario": "rescue"}),
            {"Content-Type": "application/json"},
        )
        self.assertEqual(status, 404)

    def test_sse_sends_ready_and_change_events(self):
        center.EVENT_SIGNAL.clear()
        events = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=2)
        try:
            events.request("GET", "/api/v1/events")
            response = events.getresponse()
            self.assertEqual(response.status, 200)
            self.assertTrue(response.getheader("Content-Type").startswith("text/event-stream"))
            self.assertEqual(response.fp.readline(), b"event: ready\n")
            self.assertEqual(response.fp.readline(), b"data: {}\n")
            self.assertEqual(response.fp.readline(), b"\n")

            center.notify_change()

            self.assertEqual(response.fp.readline(), b"event: update\n")
            self.assertTrue(response.fp.readline().startswith(b"data: {"))
        finally:
            events.close()

    def test_bearer_auth_protects_versioned_legacy_actions_and_pii(self):
        center.API_TOKEN = "secret-token"
        for path in ("/api/v1/overview", "/api/v1/safe-people", "/api/state"):
            status, _content_type, _body = self.request("GET", path)
            self.assertEqual(status, 401)

        status, _content_type, _body = self.request(
            "POST", "/api/v1/simulator/scenarios", json.dumps({"scenario": "rescue"}),
            {"Content-Type": "application/json"},
        )
        self.assertEqual(status, 401)
        status, _content_type, _body = self.request("POST", "/api/broadcast?message=test")
        self.assertEqual(status, 401)
        status, _content_type, _body = self.request(
            "GET", "/api/v1/overview", headers={"Authorization": "Bearer secret-token"}
        )
        self.assertEqual(status, 200)

    def test_non_loopback_requires_token(self):
        with self.assertRaises(ValueError):
            center.validate_network_config("0.0.0.0", "")
        center.validate_network_config("0.0.0.0", "secret")
        center.validate_network_config("127.0.0.1", "")


if __name__ == "__main__":
    unittest.main()
