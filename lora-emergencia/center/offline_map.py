#!/usr/bin/env python3
"""Download, crop and serve the fixed Bogotá Shortbread map package."""

import argparse
import hashlib
import json
import math
import os
import shutil
import sqlite3
import threading
import urllib.error
import urllib.request
from pathlib import Path


SOURCE_URL = "https://download.geofabrik.de/south-america/colombia-shortbread-1.0.mbtiles"
USER_AGENT = "LoRa-Emergencia-Offline-Map/1.0 (Bogota emergency center)"
BOGOTA_BOUNDS = (-74.25, 4.45, -73.95, 4.85)
MIN_ZOOM = 11
MAX_NATIVE_ZOOM = 14
MAX_VISUAL_ZOOM = 16
MAX_SOURCE_BYTES = 800 * 1024 * 1024
MIN_FREE_MARGIN = 128 * 1024 * 1024
ATTRIBUTION = "© OpenStreetMap contributors · Geofabrik"
MAP_DIR = Path(__file__).resolve().parent / "maps"
MAP_PATH = MAP_DIR / "bogota-shortbread.mbtiles"
SOURCE_PATH = MAP_DIR / "colombia-shortbread-1.0.mbtiles"


class MapError(RuntimeError):
    pass


def xyz_to_tms(z, y):
    return (1 << z) - 1 - y


def lon_to_tile_x(lon, zoom):
    value = int(math.floor((lon + 180.0) / 360.0 * (1 << zoom)))
    return max(0, min((1 << zoom) - 1, value))


def lat_to_tile_y(lat, zoom):
    latitude = max(-85.05112878, min(85.05112878, lat))
    radians = math.radians(latitude)
    value = int(math.floor((1.0 - math.asinh(math.tan(radians)) / math.pi) / 2.0 * (1 << zoom)))
    return max(0, min((1 << zoom) - 1, value))


def tile_ranges(bounds=BOGOTA_BOUNDS, min_zoom=MIN_ZOOM, max_zoom=MAX_NATIVE_ZOOM):
    west, south, east, north = bounds
    if not (-180 <= west < east <= 180 and -85.05112878 <= south < north <= 85.05112878):
        raise ValueError("invalid bounds")
    for zoom in range(min_zoom, max_zoom + 1):
        x_min = lon_to_tile_x(west, zoom)
        x_max = lon_to_tile_x(east, zoom)
        xyz_y_min = lat_to_tile_y(north, zoom)
        xyz_y_max = lat_to_tile_y(south, zoom)
        yield zoom, x_min, x_max, xyz_to_tms(zoom, xyz_y_max), xyz_to_tms(zoom, xyz_y_min)


def _connect_readonly(path):
    uri = "file:{}?mode=ro".format(Path(path).resolve().as_posix())
    return sqlite3.connect(uri, uri=True, timeout=5)


def read_metadata(path):
    with _connect_readonly(path) as database:
        return dict(database.execute("SELECT name, value FROM metadata"))


def validate_mbtiles(path, require_bogota=False):
    path = Path(path)
    if not path.is_file() or path.stat().st_size < 1:
        raise MapError("MBTiles file is missing or empty")
    try:
        with _connect_readonly(path) as database:
            if database.execute("PRAGMA quick_check").fetchone()[0] != "ok":
                raise MapError("SQLite integrity check failed")
            objects = {row[0] for row in database.execute(
                "SELECT name FROM sqlite_master WHERE name IN ('metadata','tiles')"
            )}
            if objects != {"metadata", "tiles"}:
                raise MapError("MBTiles metadata/tiles tables are missing")
            metadata = dict(database.execute("SELECT name, value FROM metadata"))
            if metadata.get("format", "").lower() not in {"pbf", "mvt"}:
                raise MapError("MBTiles format must be pbf")
            count = database.execute("SELECT COUNT(*) FROM tiles").fetchone()[0]
            if count < 1:
                raise MapError("MBTiles contains no tiles")
            if require_bogota:
                if metadata.get("bounds") != ",".join(str(value) for value in BOGOTA_BOUNDS):
                    raise MapError("MBTiles Bogotá bounds are invalid")
                if metadata.get("minzoom") != str(MIN_ZOOM) or metadata.get("maxzoom") != str(MAX_NATIVE_ZOOM):
                    raise MapError("MBTiles zoom metadata is invalid")
            raw_json = metadata.get("json")
            if raw_json:
                try:
                    layers = json.loads(raw_json).get("vector_layers", [])
                except (TypeError, ValueError, AttributeError) as exc:
                    raise MapError("MBTiles vector layer metadata is invalid") from exc
                if not layers:
                    raise MapError("MBTiles vector layer metadata is empty")
            return {"metadata": metadata, "tiles": count, "size": path.stat().st_size}
    except sqlite3.Error as exc:
        raise MapError("invalid SQLite MBTiles: {}".format(exc)) from exc


def map_generation(path):
    """Return a stable, path-free fingerprint for a valid map package."""
    validate_mbtiles(path, require_bogota=True)
    stat = Path(path).stat()
    value = "{}:{}".format(stat.st_mtime_ns, stat.st_size).encode("ascii")
    return hashlib.sha256(value).hexdigest()[:16]


def crop_mbtiles(source_path, output_path=MAP_PATH, progress=None):
    source_path = Path(source_path)
    output_path = Path(output_path)
    validate_mbtiles(source_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    temporary = output_path.with_suffix(output_path.suffix + ".tmp")
    temporary.unlink(missing_ok=True)
    source = _connect_readonly(source_path)
    target = sqlite3.connect(str(temporary))
    try:
        metadata = dict(source.execute("SELECT name, value FROM metadata"))
        with target:
            target.execute("CREATE TABLE metadata (name TEXT PRIMARY KEY, value TEXT NOT NULL)")
            target.execute(
                "CREATE TABLE tiles (zoom_level INTEGER NOT NULL, tile_column INTEGER NOT NULL, "
                "tile_row INTEGER NOT NULL, tile_data BLOB NOT NULL, "
                "UNIQUE (zoom_level, tile_column, tile_row))"
            )
            copied = 0
            for zoom, x_min, x_max, tms_y_min, tms_y_max in tile_ranges():
                rows = source.execute(
                    "SELECT zoom_level,tile_column,tile_row,tile_data FROM tiles "
                    "WHERE zoom_level=? AND tile_column BETWEEN ? AND ? AND tile_row BETWEEN ? AND ?",
                    (zoom, x_min, x_max, tms_y_min, tms_y_max),
                )
                batch = []
                for row in rows:
                    batch.append(row)
                    if len(batch) == 250:
                        target.executemany("INSERT INTO tiles VALUES (?,?,?,?)", batch)
                        copied += len(batch)
                        batch.clear()
                        if progress:
                            progress("cropping", copied, None)
                if batch:
                    target.executemany("INSERT INTO tiles VALUES (?,?,?,?)", batch)
                    copied += len(batch)
                    if progress:
                        progress("cropping", copied, None)
            metadata.update({
                "name": "Bogotá Shortbread offline",
                "bounds": ",".join(str(value) for value in BOGOTA_BOUNDS),
                "center": "-74.10,4.65,12",
                "minzoom": str(MIN_ZOOM),
                "maxzoom": str(MAX_NATIVE_ZOOM),
                "format": "pbf",
                "attribution": ATTRIBUTION,
            })
            target.executemany("INSERT INTO metadata(name,value) VALUES (?,?)", metadata.items())
            target.execute("CREATE UNIQUE INDEX tile_index ON tiles (zoom_level,tile_column,tile_row)")
        target.close()
        target = None
        result = validate_mbtiles(temporary, require_bogota=True)
        os.replace(temporary, output_path)
        return result
    except Exception:
        temporary.unlink(missing_ok=True)
        raise
    finally:
        source.close()
        if target is not None:
            target.close()


def _remote_size(opener=urllib.request.urlopen):
    request = urllib.request.Request(SOURCE_URL, method="HEAD", headers={"User-Agent": USER_AGENT})
    try:
        with opener(request, timeout=30) as response:
            size = int(response.headers.get("Content-Length", "0"))
    except (OSError, ValueError, urllib.error.URLError) as exc:
        raise MapError("could not inspect Geofabrik download: {}".format(exc)) from exc
    if not 1 <= size <= MAX_SOURCE_BYTES:
        raise MapError("unexpected Geofabrik download size")
    return size


def ensure_disk_space(directory, source_size):
    directory.mkdir(parents=True, exist_ok=True)
    required = source_size + max(source_size // 4, MIN_FREE_MARGIN)
    if shutil.disk_usage(directory).free < required:
        raise MapError("insufficient disk space (requires about {} MB free)".format(required // 1024 // 1024))


def download_source(destination=SOURCE_PATH, progress=None, opener=urllib.request.urlopen):
    destination = Path(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    expected = _remote_size(opener)
    ensure_disk_space(destination.parent, expected)
    partial = destination.with_suffix(destination.suffix + ".part")
    offset = partial.stat().st_size if partial.exists() else 0
    if offset > expected:
        partial.unlink()
        offset = 0
    headers = {"User-Agent": USER_AGENT}
    if offset:
        headers["Range"] = "bytes={}-".format(offset)
    request = urllib.request.Request(SOURCE_URL, headers=headers)
    try:
        with opener(request, timeout=60) as response:
            resumed = offset > 0 and getattr(response, "status", response.getcode()) == 206
            if offset and not resumed:
                offset = 0
            mode = "ab" if resumed else "wb"
            with partial.open(mode) as output:
                downloaded = offset
                while True:
                    chunk = response.read(1024 * 1024)
                    if not chunk:
                        break
                    output.write(chunk)
                    downloaded += len(chunk)
                    if downloaded > MAX_SOURCE_BYTES:
                        raise MapError("download exceeded safety limit")
                    if progress:
                        progress("downloading", downloaded, expected)
                output.flush()
                os.fsync(output.fileno())
    except Exception:
        if partial.exists() and partial.stat().st_size > MAX_SOURCE_BYTES:
            partial.unlink()
        raise
    if partial.stat().st_size != expected:
        partial.unlink(missing_ok=True)
        raise MapError("download is incomplete")
    os.replace(partial, destination)
    try:
        validate_mbtiles(destination)
    except Exception:
        destination.unlink(missing_ok=True)
        raise
    return destination


def prepare_map(output_path=MAP_PATH, source_path=SOURCE_PATH, progress=None, opener=urllib.request.urlopen):
    source_path = Path(source_path)
    try:
        validate_mbtiles(source_path)
    except MapError:
        source_path.unlink(missing_ok=True)
        source_path = download_source(source_path, progress, opener)
    result = crop_mbtiles(source_path, output_path, progress)
    source_path.unlink(missing_ok=True)
    return result


class MapManager:
    def __init__(self, map_path=MAP_PATH, source_path=SOURCE_PATH, prepare=prepare_map):
        self.map_path = Path(map_path)
        self.source_path = Path(source_path)
        self._prepare = prepare
        self._lock = threading.Lock()
        self._generation = self._read_generation()
        self._available = self._generation is not None
        self._downloading = False
        self._stage = "ready" if self._available else "unavailable"
        self._downloaded = 0
        self._total = None
        self._error = ""

    def _read_generation(self):
        try:
            return map_generation(self.map_path)
        except (MapError, OSError):
            return None

    def status(self):
        with self._lock:
            total = self._total
            downloaded = self._downloaded
            tiles = "/map/tiles/{z}/{x}/{y}.pbf"
            if self._generation:
                tiles += "?v=" + self._generation
            return {
                "available": self._available,
                "generation": self._generation,
                "downloading": self._downloading,
                "progress": {
                    "stage": self._stage,
                    "downloaded": downloaded,
                    "total": total,
                    "percent": round(downloaded * 100 / total, 1) if total else None,
                },
                "error": self._error or None,
                "bounds": list(BOGOTA_BOUNDS),
                "minzoom": MIN_ZOOM,
                "maxNativeZoom": MAX_NATIVE_ZOOM,
                "maxzoom": MAX_VISUAL_ZOOM,
                "attribution": ATTRIBUTION,
                "tiles": tiles,
            }

    def start(self):
        with self._lock:
            if self._downloading:
                return False
            self._downloading = True
            self._stage = "checking"
            self._downloaded = 0
            self._total = None
            self._error = ""
        threading.Thread(target=self._run, name="offline-map-download", daemon=True).start()
        return True

    def _progress(self, stage, downloaded, total):
        with self._lock:
            self._stage = stage
            self._downloaded = downloaded
            self._total = total

    def _run(self):
        try:
            self._prepare(self.map_path, self.source_path, self._progress)
            generation = self._read_generation()
            if generation is None:
                raise MapError("prepared map package is invalid")
            with self._lock:
                self._available = True
                self._generation = generation
                self._stage = "ready"
        except Exception:
            with self._lock:
                self._stage = "error"
                self._error = "No se pudo preparar el mapa offline"
        finally:
            with self._lock:
                self._downloading = False


def get_tile(map_path, zoom, x, y):
    if zoom < MIN_ZOOM or zoom > MAX_NATIVE_ZOOM or min(x, y) < 0 or x >= (1 << zoom) or y >= (1 << zoom):
        return None
    try:
        with _connect_readonly(map_path) as database:
            row = database.execute(
                "SELECT tile_data FROM tiles WHERE zoom_level=? AND tile_column=? AND tile_row=?",
                (zoom, x, xyz_to_tms(zoom, y)),
            ).fetchone()
            return bytes(row[0]) if row else None
    except sqlite3.Error:
        return None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("download", "status"))
    args = parser.parse_args()
    if args.command == "status":
        print(json.dumps(MapManager().status(), ensure_ascii=False, indent=2))
        return

    def report(stage, value, total):
        if total:
            print("\r{}: {:.1f}%".format(stage, value * 100 / total), end="", flush=True)
        else:
            print("\r{}: {} tiles".format(stage, value), end="", flush=True)

    result = prepare_map(progress=report)
    print("\nReady: {} tiles, {:.1f} MB".format(result["tiles"], result["size"] / 1024 / 1024))


if __name__ == "__main__":
    main()
