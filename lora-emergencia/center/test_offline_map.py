import io
import json
import sqlite3
import tempfile
import threading
import time
import unittest
from pathlib import Path

import offline_map


def create_mbtiles(path, bogota_metadata=False, tile_data=b"\x1f\x8btest"):
    database = sqlite3.connect(str(path))
    with database:
        database.execute("CREATE TABLE metadata (name TEXT PRIMARY KEY, value TEXT NOT NULL)")
        database.execute(
            "CREATE TABLE tiles (zoom_level INTEGER, tile_column INTEGER, tile_row INTEGER, tile_data BLOB, "
            "UNIQUE(zoom_level,tile_column,tile_row))"
        )
        metadata = {
            "name": "Shortbread fixture",
            "format": "pbf",
            "json": json.dumps({"vector_layers": [{"id": "streets"}, {"id": "buildings"}]}),
        }
        if bogota_metadata:
            metadata.update({
                "bounds": ",".join(str(value) for value in offline_map.BOGOTA_BOUNDS),
                "minzoom": str(offline_map.MIN_ZOOM),
                "maxzoom": str(offline_map.MAX_NATIVE_ZOOM),
            })
        database.executemany("INSERT INTO metadata VALUES (?,?)", metadata.items())
        for zoom in range(offline_map.MIN_ZOOM, offline_map.MAX_NATIVE_ZOOM + 1):
            x = offline_map.lon_to_tile_x(-74.05, zoom)
            y = offline_map.lat_to_tile_y(4.67, zoom)
            database.execute("INSERT INTO tiles VALUES (?,?,?,?)", (zoom, x, offline_map.xyz_to_tms(zoom, y), tile_data))
            database.execute("INSERT INTO tiles VALUES (?,?,?,?)", (zoom, 0, 0, b"outside"))
    database.close()


class FakeResponse(io.BytesIO):
    def __init__(self, body=b"", status=200, headers=None):
        super().__init__(body)
        self.status = status
        self.headers = headers or {}

    def getcode(self):
        return self.status

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        self.close()


class OfflineMapTests(unittest.TestCase):
    def test_bogota_tile_ranges_and_xyz_tms_are_consistent(self):
        self.assertEqual(offline_map.xyz_to_tms(14, offline_map.xyz_to_tms(14, 7800)), 7800)
        for zoom, x_min, x_max, row_min, row_max in offline_map.tile_ranges():
            x = offline_map.lon_to_tile_x(-74.05, zoom)
            row = offline_map.xyz_to_tms(zoom, offline_map.lat_to_tile_y(4.67, zoom))
            self.assertLessEqual(x_min, x)
            self.assertLessEqual(x, x_max)
            self.assertLessEqual(row_min, row)
            self.assertLessEqual(row, row_max)

    def test_crop_keeps_only_intersecting_tiles_and_rewrites_metadata(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "source.mbtiles"
            output = Path(directory) / "bogota.mbtiles"
            create_mbtiles(source)

            result = offline_map.crop_mbtiles(source, output)
            metadata = offline_map.read_metadata(output)

            self.assertEqual(result["tiles"], 4)
            self.assertEqual(metadata["bounds"], "-74.25,4.45,-73.95,4.85")
            self.assertEqual(metadata["center"], "-74.10,4.65,12")
            self.assertEqual(metadata["minzoom"], "11")
            self.assertEqual(metadata["maxzoom"], "14")
            self.assertEqual(metadata["attribution"], offline_map.ATTRIBUTION)
            self.assertFalse(output.with_suffix(".mbtiles.tmp").exists())

    def test_validation_rejects_non_vector_mbtiles(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "invalid.mbtiles"
            create_mbtiles(path)
            with sqlite3.connect(str(path)) as database:
                database.execute("UPDATE metadata SET value='png' WHERE name='format'")
            with self.assertRaises(offline_map.MapError):
                offline_map.validate_mbtiles(path)

    def test_failed_crop_preserves_previous_valid_map(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "bogota.mbtiles"
            source = Path(directory) / "broken.mbtiles"
            create_mbtiles(output, bogota_metadata=True, tile_data=b"previous")
            before = output.read_bytes()
            source.write_bytes(b"not sqlite")

            with self.assertRaises(offline_map.MapError):
                offline_map.crop_mbtiles(source, output)

            self.assertEqual(output.read_bytes(), before)
            self.assertFalse(output.with_suffix(".mbtiles.tmp").exists())

    def test_downloader_uses_fixed_url_and_atomic_part(self):
        with tempfile.TemporaryDirectory() as directory:
            fixture = Path(directory) / "fixture.mbtiles"
            destination = Path(directory) / "download.mbtiles"
            create_mbtiles(fixture)
            body = fixture.read_bytes()
            requests = []

            def opener(request, timeout):
                requests.append((request.full_url, request.get_method(), timeout, request.headers))
                if request.get_method() == "HEAD":
                    return FakeResponse(headers={"Content-Length": str(len(body))})
                return FakeResponse(body, headers={"Content-Length": str(len(body))})

            offline_map.download_source(destination, opener=opener)

            self.assertEqual({item[0] for item in requests}, {offline_map.SOURCE_URL})
            self.assertEqual([item[1] for item in requests], ["HEAD", "GET"])
            self.assertTrue(any("LoRa-Emergencia" in str(item[3]) for item in requests))
            self.assertEqual(offline_map.validate_mbtiles(destination)["tiles"], 8)
            self.assertFalse(destination.with_suffix(".mbtiles.part").exists())

    def test_map_manager_allows_only_one_background_task(self):
        with tempfile.TemporaryDirectory() as directory:
            started = threading.Event()
            release = threading.Event()

            def prepare(output, _source, progress):
                started.set()
                progress("downloading", 1, 2)
                release.wait(2)
                create_mbtiles(output, bogota_metadata=True)

            manager = offline_map.MapManager(
                Path(directory) / "map.mbtiles", Path(directory) / "source.mbtiles", prepare
            )
            self.assertTrue(manager.start())
            self.assertTrue(started.wait(1))
            self.assertFalse(manager.start())
            self.assertTrue(manager.status()["downloading"])
            release.set()
            for _ in range(100):
                if not manager.status()["downloading"]:
                    break
                threading.Event().wait(.01)
            self.assertTrue(manager.status()["available"])

    def test_map_generation_and_tile_url_change_after_atomic_replacement(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "map.mbtiles"
            source = Path(directory) / "source.mbtiles"
            create_mbtiles(path, bogota_metadata=True, tile_data=b"first")
            first = offline_map.MapManager(path, source).status()
            time.sleep(.002)
            replacement = Path(directory) / "replacement.mbtiles"
            create_mbtiles(replacement, bogota_metadata=True, tile_data=b"second-package")
            replacement.replace(path)
            second = offline_map.MapManager(path, source).status()

            self.assertNotEqual(first["generation"], second["generation"])
            self.assertNotEqual(first["tiles"], second["tiles"])
            self.assertEqual((first["maxNativeZoom"], first["maxzoom"]), (14, 16))
            self.assertEqual(first["tiles"], "/map/tiles/{z}/{x}/{y}.pbf?v=" + first["generation"])
            self.assertNotIn(directory, first["generation"])

    def test_map_manager_refreshes_generation_and_sanitizes_prepare_errors(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "map.mbtiles"
            create_mbtiles(path, bogota_metadata=True, tile_data=b"first")

            def replace(output, _source, _progress):
                replacement = Path(directory) / "replacement.mbtiles"
                create_mbtiles(replacement, bogota_metadata=True, tile_data=b"replacement")
                replacement.replace(output)

            manager = offline_map.MapManager(path, Path(directory) / "source.mbtiles", replace)
            previous = manager.status()["generation"]
            self.assertTrue(manager.start())
            for _ in range(100):
                if not manager.status()["downloading"]:
                    break
                threading.Event().wait(.01)
            self.assertNotEqual(previous, manager.status()["generation"])

            def fail(_output, _source, _progress):
                raise RuntimeError("secret /internal/path")

            manager = offline_map.MapManager(path, Path(directory) / "source.mbtiles", fail)
            self.assertTrue(manager.start())
            for _ in range(100):
                if not manager.status()["downloading"]:
                    break
                threading.Event().wait(.01)
            self.assertEqual(manager.status()["error"], "No se pudo preparar el mapa offline")


if __name__ == "__main__":
    unittest.main()
