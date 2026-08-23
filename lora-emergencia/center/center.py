#!/usr/bin/env python3
"""Offline command center: serial LoRa gateway, SQLite and local dashboard."""

import argparse
import hashlib
import hmac
import ipaddress
import json
import os
import re
import socket
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from api import ApiError, CommandApi
from command_core import TERMINAL_STATES, CenterStore, RadioFrame
from offline_map import MapManager, get_tile
from sync_worker import SyncWorker
from triage import triage_requests


STORE = None
GATEWAY = None
API = None
DEMO = False
API_TOKEN = ""
SYNC_WORKER = None
MAP_MANAGER = MapManager()
EVENT_SIGNAL = threading.Event()
SSE_SLOTS = threading.BoundedSemaphore(8)
HANDLER_SLOTS = threading.BoundedSemaphore(32)
WEB_ROOT = Path(__file__).resolve().parent / "web"
STATIC_FILES = {
    "/": ("index.html", "text/html; charset=utf-8"),
    "/index.html": ("index.html", "text/html; charset=utf-8"),
    "/grua": ("grua.html", "text/html; charset=utf-8"),
    "/grua.html": ("grua.html", "text/html; charset=utf-8"),
    "/styles.css": ("styles.css", "text/css; charset=utf-8"),
    "/theme.js": ("theme.js", "text/javascript; charset=utf-8"),
    "/app.js": ("app.js", "text/javascript; charset=utf-8"),
    "/grua.js": ("grua.js", "text/javascript; charset=utf-8"),
    "/operadores.js": ("operadores.js", "text/javascript; charset=utf-8"),
    "/vendor/leaflet-1.9.4.css": ("vendor/leaflet.css", "text/css; charset=utf-8"),
    "/vendor/leaflet-1.9.4.js": ("vendor/leaflet.js", "text/javascript; charset=utf-8"),
    "/vendor/leaflet-vectorgrid-1.3.0.js": ("vendor/leaflet-vectorgrid.js", "text/javascript; charset=utf-8"),
    "/vendor/LEAFLET-LICENSE.txt": ("vendor/LEAFLET-LICENSE.txt", "text/plain; charset=utf-8"),
    "/vendor/LEAFLET-VECTORGRID-LICENSE.txt": ("vendor/LEAFLET-VECTORGRID-LICENSE.txt", "text/plain; charset=utf-8"),
}
IMMUTABLE_STATIC = {
    "/vendor/leaflet-1.9.4.css", "/vendor/leaflet-1.9.4.js", "/vendor/leaflet-vectorgrid-1.3.0.js",
}
TILE_PATH = re.compile(r"/map/tiles/(\d{1,2})/(\d{1,8})/(\d{1,8})\.pbf")


def notify_change():
    EVENT_SIGNAL.set()


class SerialGateway:
    """Owns the bidirectional serial seam and correlates directed ACKs."""

    def __init__(self, port, on_line, baud=115200):
        self.port = port
        self.baud = baud
        self.on_line = on_line
        self._serial = None
        self._write_lock = threading.Lock()
        self._pending_lock = threading.Lock()
        self._pending = {}
        self._connected = False

    @property
    def connected(self):
        return self._connected

    def start(self):
        threading.Thread(target=self._run, daemon=True).start()

    def _run(self):
        try:
            import serial
        except ImportError:
            print("Falta pyserial. Instala: pip install pyserial")
            return
        while True:
            try:
                connection = serial.Serial(self.port, self.baud, timeout=0.2)
                with self._write_lock:
                    self._serial = connection
                    self._connected = True
                print("Gateway conectado en {} @ {}".format(self.port, self.baud))
                while True:
                    raw = connection.readline().decode(errors="ignore").strip()
                    if raw:
                        self.on_line(raw)
            except Exception as exc:
                print("Gateway no disponible: {}. Reintento en 2 s...".format(exc))
                with self._write_lock:
                    self._connected = False
                    if self._serial:
                        try:
                            self._serial.close()
                        except Exception:
                            pass
                    self._serial = None
                time.sleep(2)

    def _write(self, frame):
        command = "TX|{}\n".format(frame.encode()).encode()
        with self._write_lock:
            if not self._serial or not self._connected:
                return False
            try:
                self._serial.write(command)
                self._serial.flush()
                return True
            except Exception:
                self._connected = False
                return False

    def notify_ack(self, origin, destination, message_id):
        if destination != "CENTRO":
            return
        with self._pending_lock:
            event = self._pending.get((origin, message_id))
        if event:
            event.set()

    def send_reliable(self, frame, attempts=3, timeout=1.6):
        key = (frame.destination, frame.message_id)
        event = threading.Event()
        with self._pending_lock:
            self._pending[key] = event
        try:
            for attempt in range(attempts):
                if not self._write(frame):
                    return False, "GATEWAY_OFFLINE"
                if event.wait(timeout):
                    return True, "DELIVERED"
                if attempt + 1 < attempts:
                    time.sleep(0.15 * (attempt + 1))
            return False, "UNCONFIRMED"
        finally:
            with self._pending_lock:
                self._pending.pop(key, None)

    def send_broadcast(self, frame, repeats=3):
        if not self.connected:
            return False
        for index in range(repeats):
            if not self._write(frame):
                return False
            if index + 1 < repeats:
                time.sleep(0.45)
        return True


class DemoGateway:
    """Radio adapter for exercising operational flows without hardware."""

    connected = True

    def send_reliable(self, _frame, attempts=3, timeout=1.6):
        return True, "DEMO_DELIVERED"

    def send_broadcast(self, _frame, repeats=3):
        return True


def split_gateway_rx(line):
    if not line.startswith("RX|") or "|RSSI:" not in line or "|SNR:" not in line:
        raise ValueError("not a structured RX line")
    frame_and_rssi, snr = line[3:].rsplit("|SNR:", 1)
    raw_frame, rssi = frame_and_rssi.rsplit("|RSSI:", 1)
    return RadioFrame.parse(raw_frame), rssi.strip(), snr.strip()


def handle_gateway_line(line):
    if line.startswith("ACK|"):
        parts = line.split("|")
        if len(parts) >= 4:
            try:
                GATEWAY.notify_ack(parts[1], parts[2], int(parts[3]))
            except ValueError:
                pass
        return
    if line.startswith("RX|"):
        try:
            frame, rssi, snr = split_gateway_rx(line)
            result = STORE.ingest(frame, rssi, snr)
            notify_change()
            print("[RX] {} {} id={}: {}".format(frame.kind, frame.origin, frame.message_id, result))
            # Loop bidireccional por radio:
            # - SOS nuevo -> aviso automatico "RECIBIDA" al rescatista.
            # - ACC/ST de una grua real -> notifica el estado nuevo al rescatista.
            if API is not None:
                if frame.kind == "SOS" and result == "CREATED":
                    API._notify_citizen(STORE.get_request_by_node_seq(frame.origin, frame.message_id))
                elif frame.kind in ("ACC", "ST") and len(frame.payload) >= 2:
                    API._notify_citizen(STORE.get_request_by_node_seq(frame.payload[0], frame.payload[1]))
        except ValueError as exc:
            print("[RX INVALIDO] {}: {}".format(exc, line))
        return
    if line.startswith(("TX_ERROR|", "RADIO_ERROR|")):
        print("[GATEWAY] {}".format(line))


def seed_demo(store):
    frames = [
        "CIVIL1|CENTRO|SOS|1|RESCATE|1|4.6767|-74.0483|-|2 atrapados sotano",
        "CIVIL2|CENTRO|SOS|1|MEDICO|2|4.6712|-74.0530|-|herido inconsciente",
        "CIVIL3|CENTRO|SOS|1|GRUA|2|||Portal 80 con calle 13|vehiculo bloqueando via",
        "CIVIL4|CENTRO|SOS|1|AGUA|3|||Colegio central|familia sin agua",
        "CIVIL5|CENTRO|OK|1|Juan Perez|CC1032456|4.6790|-74.0470|apto 402",
        "GRUA07|CENTRO|HB|1|GRUA|NORTE|-|1",
        "GRUA07|CENTRO|POS|2|4.6752|-74.0491|12|0|disponible",
        "MEDICO01|CENTRO|HB|1|MEDICO|NORTE|-|1",
        "MEDICO01|CENTRO|POS|2|4.6720|-74.0522|8|0|disponible",
        "RESCATE01|CENTRO|HB|1|RESCATE|NORTE|-|1",
        "RESCATE01|CENTRO|POS|2|4.6770|-74.0480|10|0|disponible",
        "AGUA01|CENTRO|HB|1|AGUA|CENTRO|-|1",
        "AGUA01|CENTRO|POS|2|4.6740|-74.0500|15|0|disponible",
    ]
    for raw in frames:
        store.ingest(RadioFrame.parse(raw), "-55", "8.5")


class Handler(BaseHTTPRequestHandler):
    def setup(self):
        super().setup()
        self.connection.settimeout(8)

    def log_message(self, *_args):
        pass

    def send_json(self, status, value):
        body = json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_security_headers()
        self.end_headers()
        self.wfile.write(body)

    def send_error_json(self, error):
        self.send_json(error.status, {"ok": False, "error": str(error)})

    def send_tile(self, path):
        match = TILE_PATH.fullmatch(path)
        if not match:
            self.send_json(404, {"ok": False, "error": "not found"})
            return
        zoom, x, y = (int(value) for value in match.groups())
        tile = get_tile(MAP_MANAGER.map_path, zoom, x, y)
        if tile is None:
            self.send_json(404, {"ok": False, "error": "tile not found"})
            return
        etag = '"{}"'.format(hashlib.sha256(tile).hexdigest())
        self.send_response(304 if self.headers.get("If-None-Match") == etag else 200)
        self.send_header("Content-Type", "application/vnd.mapbox-vector-tile")
        self.send_header("ETag", etag)
        self.send_header("Cache-Control", "public, max-age=31536000, immutable")
        if tile.startswith(b"\x1f\x8b"):
            self.send_header("Content-Encoding", "gzip")
        if self.headers.get("If-None-Match") != etag:
            self.send_header("Content-Length", str(len(tile)))
        self.send_security_headers()
        self.end_headers()
        if self.headers.get("If-None-Match") != etag:
            self.wfile.write(tile)

    def send_security_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; "
            "img-src 'self' data: https://tile.openstreetmap.org; object-src 'none'; base-uri 'none'; "
            "frame-ancestors 'none'",
        )

    def authorized(self):
        if not API_TOKEN:
            return True
        header = self.headers.get("Authorization", "")
        prefix = "Bearer "
        supplied = header[len(prefix):] if header.startswith(prefix) else ""
        return hmac.compare_digest(supplied.encode("utf-8"), API_TOKEN.encode("utf-8"))

    def require_api_auth(self, path):
        if not path.startswith("/api/") or self.authorized():
            return True
        self.send_json(401, {"ok": False, "error": "token API requerido"})
        return False

    def send_static(self, path):
        item = STATIC_FILES.get(path)
        if not item:
            self.send_json(404, {"ok": False, "error": "not found"})
            return
        filename, content_type = item
        source = WEB_ROOT / filename
        use_gzip = path in IMMUTABLE_STATIC and self.accepts_gzip()
        body = Path(str(source) + ".gz").read_bytes() if use_gzip else source.read_bytes()
        etag = '"{}"'.format(hashlib.sha256(body).hexdigest())
        cache_control = "public, max-age=31536000, immutable" if path in IMMUTABLE_STATIC else "no-cache"
        if self.headers.get("If-None-Match") == etag:
            self.send_response(304)
            self.send_header("ETag", etag)
            self.send_header("Cache-Control", cache_control)
            if path in IMMUTABLE_STATIC:
                self.send_header("Vary", "Accept-Encoding")
            if use_gzip:
                self.send_header("Content-Encoding", "gzip")
            self.send_security_headers()
            self.end_headers()
            return
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("ETag", etag)
        self.send_header("Cache-Control", cache_control)
        if path in IMMUTABLE_STATIC:
            self.send_header("Vary", "Accept-Encoding")
        if use_gzip:
            self.send_header("Content-Encoding", "gzip")
        self.send_security_headers()
        self.end_headers()
        self.wfile.write(body)

    def accepts_gzip(self):
        for value in self.headers.get("Accept-Encoding", "").lower().split(","):
            encoding, *parameters = value.strip().split(";")
            if encoding != "gzip":
                continue
            quality = 1.0
            for parameter in parameters:
                if parameter.strip().startswith("q="):
                    try:
                        quality = float(parameter.strip()[2:])
                    except ValueError:
                        quality = 0.0
            return quality > 0
        return False

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/health":
            self.send_json(200, {"ok": True})
            return
        if parsed.path.startswith("/map/tiles/"):
            self.send_tile(parsed.path)
            return
        if not self.require_api_auth(parsed.path):
            return
        if parsed.path == "/api/v1/map":
            self.send_json(200, MAP_MANAGER.status())
            return
        if parsed.path == "/api/v1/events":
            self.send_events()
            return
        if not HANDLER_SLOTS.acquire(blocking=False):
            self.send_json(503, {"ok": False, "error": "servidor ocupado"})
            return
        try:
            if parsed.path.startswith("/api/v1/"):
                try:
                    self.send_json(200, API.get(parsed.path, parse_qs(parsed.query)))
                except ApiError as exc:
                    self.send_error_json(exc)
                return
            if parsed.path == "/api/state":
                state = STORE.state()
                state["requests"] = triage_requests(state["requests"], state["resources"])
                state["gateway"] = bool(GATEWAY and GATEWAY.connected)
                self.send_json(200, state)
                return
            self.send_static(parsed.path)
        finally:
            HANDLER_SLOTS.release()

    def read_json(self):
        if not self.headers.get("Content-Type", "").lower().startswith("application/json"):
            raise ApiError(415, "Content-Type debe ser application/json")
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            raise ApiError(400, "Content-Length inválido")
        if length < 1 or length > 16384:
            raise ApiError(413 if length > 16384 else 400, "body inválido")
        try:
            value = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            raise ApiError(400, "JSON inválido")
        if not isinstance(value, dict):
            raise ApiError(400, "JSON debe ser un objeto")
        return value

    def do_POST(self):
        parsed = urlparse(self.path)
        if not self.require_api_auth(parsed.path):
            return
        if not HANDLER_SLOTS.acquire(blocking=False):
            self.send_json(503, {"ok": False, "error": "servidor ocupado"})
            return
        try:
            if parsed.path == "/api/v1/map/download":
                if API.public_demo:
                    self.send_json(403, {
                        "ok": False,
                        "error": "descarga no disponible en la demo pública",
                    })
                    return
                try:
                    self.read_json()
                except ApiError as exc:
                    self.send_error_json(exc)
                    return
                if not MAP_MANAGER.start():
                    self.send_json(409, {"ok": False, "error": "la descarga ya está en curso"})
                    return
                self.send_json(202, {"ok": True, "map": MAP_MANAGER.status()})
                return
            if parsed.path.startswith("/api/v1/"):
                try:
                    body = self.read_json()
                    self.send_json(200, API.post(parsed.path, body))
                except socket.timeout:
                    self.close_connection = True
                    self.send_json(408, {"ok": False, "error": "tiempo de lectura agotado"})
                except ApiError as exc:
                    self.send_error_json(exc)
                except (TypeError, ValueError) as exc:
                    self.send_json(409, {"ok": False, "error": str(exc)})
                return
            query = parse_qs(parsed.query)
            if parsed.path == "/api/dispatch":
                body = {
                    "resource_node": one_query(query, "resource"),
                    "actor": "operador legacy",
                    "reason": "Despacho desde endpoint temporal",
                }
                try:
                    self.send_json(200, API.dispatch(int(one_query(query, "id", "0")), body))
                except (ApiError, TypeError, ValueError) as exc:
                    status = exc.status if isinstance(exc, ApiError) else 409
                    self.send_json(status, {"ok": False, "error": str(exc)})
                return
            if parsed.path == "/api/broadcast":
                body = {
                    "message": one_query(query, "message"),
                    "scope": one_query(query, "scope", "ALL"),
                    "priority": one_query(query, "priority", "NORMAL"),
                }
                try:
                    self.send_json(200, API.broadcast(body))
                except ApiError as exc:
                    self.send_error_json(exc)
                return
            self.send_json(404, {"ok": False, "error": "not found"})
        finally:
            HANDLER_SLOTS.release()

    def send_events(self):
        if not SSE_SLOTS.acquire(blocking=False):
            self.send_json(503, {"ok": False, "error": "demasiadas conexiones SSE"})
            return
        try:
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "close")
            self.send_security_headers()
            self.end_headers()
            deadline = time.time() + 20
            self.wfile.write(b"event: ready\ndata: {}\n\n")
            self.wfile.flush()
            while time.time() < deadline:
                changed = EVENT_SIGNAL.wait(2)
                if changed:
                    EVENT_SIGNAL.clear()
                    payload = json.dumps({"changed": True, "at": time.time()}).encode("utf-8")
                    self.wfile.write(b"event: update\ndata: " + payload + b"\n\n")
                else:
                    self.wfile.write(b": keepalive\n\n")
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            pass
        finally:
            SSE_SLOTS.release()


def one_query(query, name, default=""):
    return query.get(name, [default])[0]


class CommandServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, *args, **kwargs):
        self._connection_slots = threading.BoundedSemaphore(48)
        super().__init__(*args, **kwargs)

    def process_request(self, request, client_address):
        if not self._connection_slots.acquire(blocking=False):
            self.shutdown_request(request)
            return
        try:
            super().process_request(request, client_address)
        except Exception:
            self._connection_slots.release()
            raise

    def process_request_thread(self, request, client_address):
        try:
            super().process_request_thread(request, client_address)
        finally:
            self._connection_slots.release()


def is_loopback_host(host):
    if host.lower() == "localhost":
        return True
    try:
        return ipaddress.ip_address(host).is_loopback
    except ValueError:
        return False


def validate_network_config(host, api_token, demo=False, public_demo=False):
    if public_demo:
        if not demo:
            raise ValueError("--public-demo solo puede usarse junto con --demo")
        if api_token.strip():
            raise ValueError("--public-demo no debe combinarse con --api-token")
        return
    if not is_loopback_host(host) and not api_token.strip():
        raise ValueError("--api-token es obligatorio al usar un host no loopback")


# Cuanto se sigue reenviando el estado de una solicitud ya cerrada.
CLOSED_REBROADCAST_SECONDS = 10 * 60


def status_rebroadcast_loop(interval=15):
    # Reenvia periodicamente el estado al rescatista. Los avisos ST son
    # best-effort por radio; si uno se pierde, este latido lo recupera en
    # <= interval segundos (el portal consulta /status cada 4 s).
    #
    # Incluye las solicitudes CERRADAS hace poco. RESUELTA y CANCELADA son
    # justo los avisos que mas le importan al ciudadano ("te atendieron",
    # "se cancelo") y eran los UNICOS sin reintento: salian una sola vez y,
    # si esa rafaga se perdia, el telefono se quedaba para siempre en
    # "Ayuda en camino" aunque el centro ya diera el caso por cerrado.
    while True:
        time.sleep(interval)
        try:
            if not (GATEWAY and getattr(GATEWAY, "connected", False) and API):
                continue
            for request in STORE.list_requests(open_only=True, limit=20):
                API._notify_citizen(request)
            now = time.time()
            for request in STORE.list_requests(limit=40):
                if request["state"] not in TERMINAL_STATES:
                    continue
                if now - (request["updated_at"] or 0) <= CLOSED_REBROADCAST_SECONDS:
                    API._notify_citizen(request)
        except Exception:
            pass


def main():
    global STORE, GATEWAY, API, DEMO, API_TOKEN, SYNC_WORKER
    parser = argparse.ArgumentParser()
    parser.add_argument("serial", nargs="?", default=None)
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--api-token", default="")
    parser.add_argument("--sync-url", default=os.environ.get("WOKI_SYNC_URL", ""))
    parser.add_argument("--sync-token", default=os.environ.get("WOKI_SYNC_TOKEN", ""))
    parser.add_argument("--db", default="center.db")
    parser.add_argument("--demo", action="store_true")
    parser.add_argument(
        "--public-demo", action="store_true",
        help="demo público efímero, sin radio, persistencia ni autenticación",
    )
    parser.add_argument("--sim", action="store_true",
                        help="demo con hardware: lee el gateway real pero simula el operador de grua")
    parser.add_argument("--center-lat", type=float, help="latitud fija configurada del puesto de mando")
    parser.add_argument("--center-lon", type=float, help="longitud fija configurada del puesto de mando")
    args = parser.parse_args()
    try:
        validate_network_config(args.host, args.api_token, args.demo, args.public_demo)
    except ValueError as exc:
        parser.error(str(exc))
    if bool(args.sync_url) != bool(args.sync_token):
        parser.error("--sync-url y --sync-token deben configurarse juntos")
    if args.public_demo and (args.serial or args.sim):
        parser.error("--public-demo no permite puerto serial ni --sim")
    if args.public_demo and (args.sync_url or args.sync_token):
        parser.error("--public-demo no permite sincronización externa")

    DEMO = args.demo
    API_TOKEN = args.api_token.strip()
    STORE = CenterStore(":memory:" if args.demo else args.db)
    if args.demo:
        seed_demo(STORE)
        GATEWAY = DemoGateway()
        if args.public_demo:
            print("Modo demo público: datos sintéticos y efímeros; sin radio ni credenciales.")
    elif args.serial:
        GATEWAY = SerialGateway(args.serial, handle_gateway_line)
        GATEWAY.start()
    else:
        print("Aviso: sin puerto serial. El tablero opera sin radio.")
    if (args.center_lat is None) != (args.center_lon is None):
        parser.error("--center-lat y --center-lon deben usarse juntos")
    center_position = None
    if args.center_lat is not None:
        center_position = {
            "lat": args.center_lat, "lon": args.center_lon,
            "source": "CONFIGURADA", "label": "Centro de comando",
        }
    API = CommandApi(
        STORE, GATEWAY, args.demo, notify_change, sim=args.sim,
        center_position=center_position, public_demo=args.public_demo,
    )
    if args.sync_url:
        try:
            SYNC_WORKER = SyncWorker(STORE, args.sync_url, args.sync_token)
        except ValueError as exc:
            parser.error(str(exc))
        SYNC_WORKER.start()
        print("Sincronización online habilitada.")

    # Hilo que reenvia el estado a los rescatistas por radio (recupera avisos perdidos).
    if args.serial and not args.demo:
        threading.Thread(target=status_rebroadcast_loop, daemon=True).start()

    server = CommandServer((args.host, args.port), Handler)
    print("Command center en http://{}:{} (Ctrl+C para salir)".format(args.host, args.port))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nFin.")
    finally:
        server.server_close()
        if SYNC_WORKER:
            SYNC_WORKER.stop()
        STORE.close()


if __name__ == "__main__":
    main()
