import http.client
import json
import tempfile
import threading
import time
import unittest
from pathlib import Path

import center
from api import ApiError, CommandApi
from command_core import CenterStore, RadioFrame


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
        self.assertEqual(overview["requests"][0]["id"], request_id)
        with self.assertRaises(ApiError) as context:
            self.api.get("/api/v1/requests/not-a-number", {})
        self.assertEqual(context.exception.status, 400)
        with self.assertRaises(ApiError) as context:
            self.api.get("/api/v1/resources/MISSING", {})
        self.assertEqual(context.exception.status, 404)

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
        self.assertNotIn(b"sqlite3", body)

        status, _content_type, _body = self.request("GET", "/web/app.js")
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
