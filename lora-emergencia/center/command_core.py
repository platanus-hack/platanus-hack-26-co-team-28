"""Domain and persistence core for the offline command center."""

from __future__ import annotations

import sqlite3
import threading
import time
import json
from dataclasses import dataclass
from typing import Optional, Tuple


VALID_CATEGORIES = {"GRUA", "MEDICO", "RESCATE", "AGUA", "FUEGO"}
VALID_RESOURCE_STATES = {"disponible", "reservado", "asignado", "enruta", "enlugar", "resuelta", "cancelada"}
TERMINAL_STATES = {"RESUELTA", "CANCELADA"}
RESOURCE_MAX_AGE_SECONDS = 10 * 60


def clean_field(value: object, max_length: int = 80) -> str:
    return str(value or "").replace("|", " ").replace("\n", " ").replace("\r", " ")[:max_length]


@dataclass(frozen=True)
class RadioFrame:
    origin: str
    destination: str
    kind: str
    message_id: int
    payload: tuple[str, ...]

    @classmethod
    def parse(cls, raw: str) -> "RadioFrame":
        parts = raw.strip().split("|")
        if len(parts) < 4:
            raise ValueError("frame requires origin, destination, type and message id")
        origin, destination, kind = (clean_field(value, 24) for value in parts[:3])
        if not origin or not destination or not kind:
            raise ValueError("frame header cannot contain empty fields")
        try:
            message_id = int(parts[3])
        except ValueError as exc:
            raise ValueError("message id must be an integer") from exc
        return cls(origin, destination, kind.upper(), message_id, tuple(parts[4:]))

    def encode(self) -> str:
        fields = [self.origin, self.destination, self.kind, str(self.message_id), *self.payload]
        return "|".join(clean_field(value) for value in fields)


class CenterStore:
    """SQLite-backed source of truth for requests, resources and radio events."""

    def __init__(self, path: str):
        self._db = sqlite3.connect(path, check_same_thread=False)
        self._db.row_factory = sqlite3.Row
        self._lock = threading.RLock()
        self._init_schema()

    def _init_schema(self) -> None:
        with self._lock, self._db:
            self._db.executescript(
                """
                PRAGMA journal_mode=WAL;
                CREATE TABLE IF NOT EXISTS requests (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    node TEXT NOT NULL,
                    seq INTEGER NOT NULL,
                    category TEXT NOT NULL,
                    priority INTEGER NOT NULL,
                    lat TEXT NOT NULL DEFAULT '',
                    lon TEXT NOT NULL DEFAULT '',
                    place TEXT NOT NULL DEFAULT '',
                    detail TEXT NOT NULL DEFAULT '',
                    rssi TEXT NOT NULL DEFAULT '',
                    snr TEXT NOT NULL DEFAULT '',
                    state TEXT NOT NULL DEFAULT 'PENDIENTE',
                    resource_node TEXT,
                    created_at REAL NOT NULL,
                    updated_at REAL NOT NULL,
                    UNIQUE(node, seq)
                );
                CREATE TABLE IF NOT EXISTS safe_people (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    node TEXT NOT NULL,
                    seq INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    document TEXT NOT NULL,
                    lat TEXT NOT NULL DEFAULT '',
                    lon TEXT NOT NULL DEFAULT '',
                    place TEXT NOT NULL DEFAULT '',
                    rssi TEXT NOT NULL DEFAULT '',
                    snr TEXT NOT NULL DEFAULT '',
                    created_at REAL NOT NULL,
                    UNIQUE(node, seq)
                );
                CREATE TABLE IF NOT EXISTS resources (
                    node TEXT PRIMARY KEY,
                    kind TEXT NOT NULL DEFAULT 'RECURSO',
                    zone TEXT NOT NULL DEFAULT 'SIN_ZONA',
                    state TEXT NOT NULL DEFAULT 'disponible',
                    lat TEXT NOT NULL DEFAULT '',
                    lon TEXT NOT NULL DEFAULT '',
                    accuracy TEXT NOT NULL DEFAULT '',
                    last_seen REAL NOT NULL,
                    position_seen_at REAL NOT NULL DEFAULT 0,
                    rssi TEXT NOT NULL DEFAULT '',
                    snr TEXT NOT NULL DEFAULT ''
                );
                CREATE TABLE IF NOT EXISTS radio_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    direction TEXT NOT NULL,
                    origin TEXT NOT NULL,
                    destination TEXT NOT NULL,
                    kind TEXT NOT NULL,
                    message_id INTEGER NOT NULL,
                    raw TEXT NOT NULL,
                    result TEXT NOT NULL DEFAULT '',
                    created_at REAL NOT NULL
                );
                CREATE TABLE IF NOT EXISTS broadcasts (
                    message_id INTEGER PRIMARY KEY,
                    scope TEXT NOT NULL,
                    priority TEXT NOT NULL,
                    message TEXT NOT NULL,
                    expires_at INTEGER NOT NULL,
                    created_at REAL NOT NULL,
                    status TEXT NOT NULL DEFAULT 'SENT'
                );
                CREATE TABLE IF NOT EXISTS broadcast_receipts (
                    broadcast_id INTEGER NOT NULL,
                    node TEXT NOT NULL,
                    received_at REAL NOT NULL,
                    PRIMARY KEY(broadcast_id, node)
                );
                CREATE TABLE IF NOT EXISTS request_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    request_id INTEGER NOT NULL,
                    event_type TEXT NOT NULL,
                    actor TEXT NOT NULL DEFAULT '',
                    reason TEXT NOT NULL DEFAULT '',
                    from_state TEXT,
                    to_state TEXT,
                    metadata_json TEXT NOT NULL DEFAULT '{}',
                    created_at REAL NOT NULL,
                    FOREIGN KEY(request_id) REFERENCES requests(id)
                );
                CREATE INDEX IF NOT EXISTS request_events_request_id_created_at
                    ON request_events(request_id, created_at, id);
                CREATE INDEX IF NOT EXISTS requests_priority_created_at
                    ON requests(priority, created_at);
                CREATE INDEX IF NOT EXISTS radio_events_created_at_id
                    ON radio_events(created_at DESC, id DESC);
                CREATE TABLE IF NOT EXISTS metadata (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                );
                """
            )
            resource_columns = {row[1] for row in self._db.execute("PRAGMA table_info(resources)")}
            if "position_seen_at" not in resource_columns:
                self._db.execute(
                    "ALTER TABLE resources ADD COLUMN position_seen_at REAL NOT NULL DEFAULT 0"
                )
            broadcast_columns = {row[1] for row in self._db.execute("PRAGMA table_info(broadcasts)")}
            if "status" not in broadcast_columns:
                self._db.execute(
                    "ALTER TABLE broadcasts ADD COLUMN status TEXT NOT NULL DEFAULT 'SENT'"
                )
            self._db.execute(
                "UPDATE requests SET state='ENVIO_INDETERMINADO',updated_at=? WHERE state='ENVIANDO'",
                (time.time(),),
            )
            self._db.execute("UPDATE resources SET state='asignado' WHERE state='reservado'")

    def _record_request_event(
        self, request_id: int, event_type: str, actor: str = "", reason: str = "",
        from_state: Optional[str] = None, to_state: Optional[str] = None,
        metadata: Optional[dict] = None,
    ) -> None:
        self._db.execute(
            "INSERT INTO request_events(request_id,event_type,actor,reason,from_state,to_state,metadata_json,created_at) "
            "VALUES(?,?,?,?,?,?,?,?)",
            (
                request_id, clean_field(event_type, 32), clean_field(actor, 64), clean_field(reason, 240),
                from_state, to_state, json.dumps(metadata or {}, separators=(",", ":")), time.time(),
            ),
        )

    def next_message_id(self) -> int:
        with self._lock, self._db:
            row = self._db.execute("SELECT value FROM metadata WHERE key='center_msgid'").fetchone()
            value = (int(row[0]) + 1) if row else 1
            self._db.execute(
                "INSERT INTO metadata(key,value) VALUES('center_msgid',?) "
                "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                (str(value),),
            )
            return value

    def set_center_position(self, position: dict) -> dict:
        value = json.dumps(position, separators=(",", ":"))
        with self._lock, self._db:
            self._db.execute(
                "INSERT INTO metadata(key,value) VALUES('center_position',?) "
                "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                (value,),
            )
        return position

    def get_center_position(self) -> Optional[dict]:
        with self._lock:
            row = self._db.execute(
                "SELECT value FROM metadata WHERE key='center_position'"
            ).fetchone()
        if not row:
            return None
        try:
            value = json.loads(row[0])
        except (TypeError, ValueError):
            return None
        return value if isinstance(value, dict) else None

    def record_event(self, direction: str, frame: RadioFrame, raw: str, result: str = "") -> None:
        with self._lock, self._db:
            self._db.execute(
                "INSERT INTO radio_events(direction,origin,destination,kind,message_id,raw,result,created_at) "
                "VALUES(?,?,?,?,?,?,?,?)",
                (direction, frame.origin, frame.destination, frame.kind, frame.message_id, raw, result, time.time()),
            )

    def ingest(self, frame: RadioFrame, rssi: str = "", snr: str = "") -> str:
        handlers = {
            "SOS": self._ingest_sos,
            "OK": self._ingest_safe,
            "ACC": self._ingest_accept,
            "ST": self._ingest_status,
            "POS": self._ingest_position,
            "HB": self._ingest_heartbeat,
            "BCA": self._ingest_broadcast_ack,
        }
        handler = handlers.get(frame.kind)
        result = handler(frame, rssi, snr) if handler else "IGNORED"
        self.record_event("IN", frame, frame.encode(), result)
        return result

    def _ingest_sos(self, frame: RadioFrame, rssi: str, snr: str) -> str:
        if len(frame.payload) < 6:
            return "INVALID"
        category, priority, lat, lon, place, detail = frame.payload[:6]
        category = category.upper()
        if category not in VALID_CATEGORIES:
            return "INVALID"
        try:
            priority_number = min(3, max(0, int(priority)))
        except ValueError:
            priority_number = 2
        now = time.time()
        with self._lock, self._db:
            cursor = self._db.execute(
                "INSERT OR IGNORE INTO requests"
                "(node,seq,category,priority,lat,lon,place,detail,rssi,snr,created_at,updated_at) "
                "VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
                (
                    frame.origin, frame.message_id, category, priority_number,
                    clean_field(lat), clean_field(lon), clean_field(place), clean_field(detail),
                    clean_field(rssi), clean_field(snr), now, now,
                ),
            )
            if cursor.rowcount:
                self._record_request_event(
                    cursor.lastrowid, "INGESTED", frame.origin, "Solicitud recibida por radio",
                    None, "PENDIENTE", {"message_id": frame.message_id},
                )
        return "CREATED" if cursor.rowcount else "DUPLICATE"

    def _ingest_safe(self, frame: RadioFrame, rssi: str, snr: str) -> str:
        if len(frame.payload) < 5:
            return "INVALID"
        name, document, lat, lon, place = frame.payload[:5]
        with self._lock, self._db:
            cursor = self._db.execute(
                "INSERT OR IGNORE INTO safe_people(node,seq,name,document,lat,lon,place,rssi,snr,created_at) "
                "VALUES(?,?,?,?,?,?,?,?,?,?)",
                (
                    frame.origin, frame.message_id, clean_field(name), clean_field(document),
                    clean_field(lat), clean_field(lon), clean_field(place), clean_field(rssi),
                    clean_field(snr), time.time(),
                ),
            )
        return "CREATED" if cursor.rowcount else "DUPLICATE"

    def _request_for_payload(self, payload: tuple[str, ...]):
        if len(payload) < 2:
            return None
        try:
            request_seq = int(payload[1])
        except ValueError:
            return None
        return self._db.execute(
            "SELECT * FROM requests WHERE node=? AND seq=?", (payload[0], request_seq)
        ).fetchone()

    def _ingest_accept(self, frame: RadioFrame, _rssi: str, _snr: str) -> str:
        with self._lock, self._db:
            request = self._request_for_payload(frame.payload)
            if not request or request["state"] != "DESPACHADA" or request["resource_node"] != frame.origin:
                return "REJECTED"
            self._db.execute(
                "UPDATE requests SET state='ACEPTADA',updated_at=? WHERE id=?", (time.time(), request["id"])
            )
            self._record_request_event(
                request["id"], "RESOURCE_ACCEPTED", frame.origin, "Aceptación operacional del recurso",
                request["state"], "ACEPTADA", {"message_id": frame.message_id},
            )
        return "UPDATED"

    def _ingest_status(self, frame: RadioFrame, _rssi: str, _snr: str) -> str:
        if len(frame.payload) < 3 or frame.payload[2] not in VALID_RESOURCE_STATES:
            return "INVALID"
        transitions = {
            ("ACEPTADA", "enruta"): "EN_CURSO",
            ("EN_CURSO", "enlugar"): "EN_CURSO",
            ("EN_CURSO", "resuelta"): "RESUELTA",
            ("DESPACHADA", "cancelada"): "CANCELADA",
            ("ACEPTADA", "cancelada"): "CANCELADA",
            ("EN_CURSO", "cancelada"): "CANCELADA",
        }
        with self._lock, self._db:
            request = self._request_for_payload(frame.payload)
            if not request or request["resource_node"] != frame.origin:
                return "REJECTED"
            new_state = transitions.get((request["state"], frame.payload[2]))
            if not new_state:
                return "REJECTED"
            self._db.execute(
                "UPDATE requests SET state=?,updated_at=? WHERE id=?",
                (new_state, time.time(), request["id"]),
            )
            resource_state = "disponible" if new_state in TERMINAL_STATES else frame.payload[2]
            self._db.execute("UPDATE resources SET state=? WHERE node=?", (resource_state, frame.origin))
            self._record_request_event(
                request["id"], "RESOURCE_STATUS", frame.origin, "Estado reportado por el recurso",
                request["state"], new_state,
                {"resource_state": frame.payload[2], "message_id": frame.message_id},
            )
        return "UPDATED"

    def _ingest_position(self, frame: RadioFrame, rssi: str, snr: str) -> str:
        if len(frame.payload) < 2:
            return "INVALID"
        lat, lon = frame.payload[:2]
        accuracy = frame.payload[2] if len(frame.payload) > 2 else ""
        state = frame.payload[4] if len(frame.payload) > 4 else "disponible"
        if state not in VALID_RESOURCE_STATES:
            state = "disponible"
        now = time.time()
        with self._lock, self._db:
            self._db.execute(
                "INSERT INTO resources(node,state,lat,lon,accuracy,last_seen,position_seen_at,rssi,snr) "
                "VALUES(?,?,?,?,?,?,?,?,?) "
                "ON CONFLICT(node) DO UPDATE SET "
                "state=CASE WHEN resources.state IN ('reservado','asignado','enruta','enlugar') "
                "THEN resources.state ELSE excluded.state END,lat=excluded.lat,lon=excluded.lon,"
                "accuracy=excluded.accuracy,last_seen=excluded.last_seen,"
                "position_seen_at=excluded.position_seen_at,rssi=excluded.rssi,snr=excluded.snr",
                (
                    frame.origin, state, clean_field(lat), clean_field(lon), clean_field(accuracy),
                    now, now, rssi, snr,
                ),
            )
        return "UPDATED"

    def _ingest_heartbeat(self, frame: RadioFrame, rssi: str, snr: str) -> str:
        kind = frame.payload[0] if frame.payload else "RECURSO"
        zone = frame.payload[1] if len(frame.payload) > 1 else "SIN_ZONA"
        with self._lock, self._db:
            self._db.execute(
                "INSERT INTO resources(node,kind,zone,last_seen,rssi,snr) VALUES(?,?,?,?,?,?) "
                "ON CONFLICT(node) DO UPDATE SET kind=excluded.kind,zone=excluded.zone,"
                "last_seen=excluded.last_seen,rssi=excluded.rssi,snr=excluded.snr",
                (frame.origin, clean_field(kind), clean_field(zone), time.time(), rssi, snr),
            )
        return "UPDATED"

    def _ingest_broadcast_ack(self, frame: RadioFrame, _rssi: str, _snr: str) -> str:
        if not frame.payload:
            return "INVALID"
        try:
            broadcast_id = int(frame.payload[0])
        except ValueError:
            return "INVALID"
        with self._lock, self._db:
            exists = self._db.execute(
                "SELECT 1 FROM broadcasts WHERE message_id=?", (broadcast_id,)
            ).fetchone()
            if not exists:
                return "REJECTED"
            self._db.execute(
                "INSERT OR IGNORE INTO broadcast_receipts(broadcast_id,node,received_at) VALUES(?,?,?)",
                (broadcast_id, frame.origin, time.time()),
            )
        return "UPDATED"

    def start_broadcast(self, frame: RadioFrame) -> None:
        if frame.kind != "BC" or len(frame.payload) < 4:
            raise ValueError("invalid broadcast frame")
        scope, priority, expires_at, message = frame.payload[:4]
        with self._lock, self._db:
            self._db.execute(
                "INSERT INTO broadcasts(message_id,scope,priority,message,expires_at,created_at,status) "
                "VALUES(?,?,?,?,?,?, 'SENDING')",
                (frame.message_id, scope, priority, message, int(expires_at), time.time()),
            )

    def finish_broadcast(self, frame: RadioFrame, sent: bool) -> None:
        status = "SENT" if sent else "FAILED"
        with self._lock, self._db:
            cursor = self._db.execute(
                "UPDATE broadcasts SET status=? WHERE message_id=? AND status='SENDING'",
                (status, frame.message_id),
            )
            if cursor.rowcount != 1:
                raise ValueError("broadcast is not sending")
            self._db.execute(
                "INSERT INTO radio_events(direction,origin,destination,kind,message_id,raw,result,created_at) "
                "VALUES('OUT',?,?,?,?,?,?,?)",
                (frame.origin, frame.destination, frame.kind, frame.message_id, frame.encode(), status, time.time()),
            )

    def record_broadcast(self, frame: RadioFrame) -> None:
        """Compatibility helper for callers that already completed transmission."""
        self.start_broadcast(frame)
        self.finish_broadcast(frame, True)

    def _build_dispatch(
        self, request_id: int, resource_node: str, effective_priority: Optional[int] = None
    ) -> Tuple[RadioFrame, sqlite3.Row]:
        resource_node = clean_field(resource_node, 24)
        if not resource_node:
            raise ValueError("resource node is required")
        with self._lock:
            request = self._db.execute("SELECT * FROM requests WHERE id=?", (request_id,)).fetchone()
            if not request:
                raise ValueError("request not found")
            if request["state"] not in {"PENDIENTE", "EN_REVISION"}:
                raise ValueError("request is not pending")
            resource = self._db.execute("SELECT * FROM resources WHERE node=?", (resource_node,)).fetchone()
            if not resource:
                raise ValueError("resource not found")
            if resource["kind"].upper() != request["category"]:
                raise ValueError("resource is not compatible with request category")
            if resource["state"] != "disponible":
                raise ValueError("resource is not available")
            if time.time() - resource["last_seen"] > RESOURCE_MAX_AGE_SECONDS:
                raise ValueError("resource has stale communication")
            priority = request["priority"]
            if effective_priority is not None:
                priority = min(priority, max(0, min(3, int(effective_priority))))
            frame = RadioFrame(
                "CENTRO", resource_node, "DISP", self.next_message_id(),
                (
                    request["node"], str(request["seq"]), request["lat"], request["lon"],
                    request["place"], request["category"], str(priority), request["detail"],
                ),
            )
            return frame, request

    def reserve_dispatch(
        self, request_id: int, resource_node: str, effective_priority: Optional[int] = None
    ) -> Tuple[RadioFrame, sqlite3.Row]:
        with self._lock, self._db:
            frame, request = self._build_dispatch(request_id, resource_node, effective_priority)
            request_cursor = self._db.execute(
                "UPDATE requests SET state='ENVIANDO',resource_node=?,updated_at=? "
                "WHERE id=? AND state IN ('PENDIENTE','EN_REVISION')",
                (resource_node, time.time(), request_id),
            )
            resource_cursor = self._db.execute(
                "UPDATE resources SET state='reservado' WHERE node=? AND state='disponible'",
                (resource_node,),
            )
            if request_cursor.rowcount != 1 or resource_cursor.rowcount != 1:
                raise ValueError("request or resource was reserved concurrently")
            return frame, request

    def release_dispatch(self, request_id: int, resource_node: str, previous_state: str = "PENDIENTE") -> None:
        if previous_state not in {"PENDIENTE", "EN_REVISION"}:
            previous_state = "PENDIENTE"
        with self._lock, self._db:
            self._db.execute(
                "UPDATE requests SET state=?,resource_node=NULL,updated_at=? "
                "WHERE id=? AND state='ENVIANDO' AND resource_node=?",
                (previous_state, time.time(), request_id, resource_node),
            )
            self._db.execute(
                "UPDATE resources SET state='disponible' WHERE node=? AND state='reservado'",
                (resource_node,),
            )

    def mark_dispatched(
        self, request_id: int, resource_node: str, frame: RadioFrame,
        actor: str = "operador", reason: str = "",
    ) -> None:
        with self._lock, self._db:
            cursor = self._db.execute(
                "UPDATE requests SET state='DESPACHADA',resource_node=?,updated_at=? "
                "WHERE id=? AND state='ENVIANDO' AND resource_node=?",
                (resource_node, time.time(), request_id, resource_node),
            )
            if cursor.rowcount != 1:
                raise ValueError("request was assigned concurrently")
            resource_cursor = self._db.execute(
                "UPDATE resources SET state='asignado' WHERE node=? AND state='reservado'",
                (resource_node,),
            )
            if resource_cursor.rowcount != 1:
                raise ValueError("resource reservation was lost")
            self._record_request_event(
                request_id, "DISPATCHED", actor, reason, "ENVIANDO", "DESPACHADA",
                {"resource_node": resource_node, "message_id": frame.message_id},
            )
        self.record_event("OUT", frame, frame.encode(), "DELIVERED")

    def request_action(self, request_id: int, action: str, actor: str, reason: str) -> dict:
        transitions = {
            "review": ({"PENDIENTE"}, "EN_REVISION"),
            "release": ({"ENVIO_INDETERMINADO"}, "EN_REVISION"),
            "cancel": ({"PENDIENTE", "EN_REVISION"}, "CANCELADA"),
            "resolve": ({"ACEPTADA", "EN_CURSO"}, "RESUELTA"),
        }
        if action not in transitions:
            raise ValueError("invalid action")
        allowed, to_state = transitions[action]
        with self._lock, self._db:
            request = self._db.execute("SELECT * FROM requests WHERE id=?", (request_id,)).fetchone()
            if not request:
                raise ValueError("request not found")
            if request["state"] not in allowed:
                raise ValueError("invalid state transition")
            if action == "cancel" and request["resource_node"]:
                raise ValueError("active resource assignment must be released or confirmed by radio")
            if action == "release":
                resource_node = request["resource_node"]
                if not resource_node:
                    raise ValueError("indeterminate dispatch has no resource assignment")
                self._db.execute(
                    "UPDATE resources SET state='disponible' WHERE node=? AND state='asignado'",
                    (resource_node,),
                )
            self._db.execute(
                "UPDATE requests SET state=?,resource_node=CASE WHEN ?='release' THEN NULL ELSE resource_node END,updated_at=? WHERE id=?",
                (to_state, action, time.time(), request_id),
            )
            if to_state in TERMINAL_STATES and request["resource_node"]:
                self._db.execute(
                    "UPDATE resources SET state='disponible' WHERE node=?", (request["resource_node"],)
                )
            self._record_request_event(
                request_id, "HUMAN_" + action.upper(), actor, reason,
                request["state"], to_state, {},
            )
        return self.get_request(request_id)

    def list_requests(self, state="", category="", priority=None, query="", limit=100, open_only=False):
        clauses, values = [], []
        if state:
            clauses.append("state=?")
            values.append(state)
        if category:
            clauses.append("category=?")
            values.append(category)
        if priority is not None:
            clauses.append("priority=?")
            values.append(priority)
        if query:
            clauses.append("(node LIKE ? OR place LIKE ? OR detail LIKE ? OR resource_node LIKE ?)")
            term = "%" + query + "%"
            values.extend([term] * 4)
        if open_only:
            clauses.append("state NOT IN ('RESUELTA','CANCELADA')")
        where = " WHERE " + " AND ".join(clauses) if clauses else ""
        limit_sql = ""
        if limit is not None:
            values.append(limit)
            limit_sql = " LIMIT ?"
        with self._lock:
            return [dict(row) for row in self._db.execute(
                "SELECT * FROM requests" + where + " ORDER BY priority,created_at" + limit_sql, values
            )]

    def get_request(self, request_id: int):
        with self._lock:
            row = self._db.execute("SELECT * FROM requests WHERE id=?", (request_id,)).fetchone()
        return dict(row) if row else None

    def get_request_by_node_seq(self, node: str, seq):
        # Busca la solicitud de un ciudadano por su nodo y su secuencia de origen.
        # Lo usa el centro para notificarle al rescatista el estado de SU solicitud.
        try:
            seq_int = int(seq)
        except (TypeError, ValueError):
            return None
        with self._lock:
            row = self._db.execute(
                "SELECT * FROM requests WHERE node=? AND seq=? ORDER BY id DESC LIMIT 1",
                (node, seq_int),
            ).fetchone()
        return dict(row) if row else None

    def request_timeline(self, request_id: int):
        with self._lock:
            return [dict(row) for row in self._db.execute(
                "SELECT * FROM request_events WHERE request_id=? ORDER BY created_at,id", (request_id,)
            )]

    def list_resources(self, state="", kind="", zone="", limit=None):
        clauses, values = [], []
        for column, value in (("state", state), ("kind", kind), ("zone", zone)):
            if value:
                clauses.append(column + "=?")
                values.append(value)
        where = " WHERE " + " AND ".join(clauses) if clauses else ""
        limit_sql = ""
        if limit is not None:
            values.append(limit)
            limit_sql = " LIMIT ?"
        with self._lock:
            return [dict(row) for row in self._db.execute(
                "SELECT * FROM resources" + where + " ORDER BY node" + limit_sql, values
            )]

    def resource_counts(self):
        with self._lock:
            total = self._db.execute("SELECT COUNT(*) FROM resources").fetchone()[0]
            available = self._db.execute(
                "SELECT COUNT(*) FROM resources WHERE state='disponible'"
            ).fetchone()[0]
        return {"total": total, "available": available}

    def get_resource(self, node: str):
        with self._lock:
            row = self._db.execute("SELECT * FROM resources WHERE node=?", (node,)).fetchone()
        return dict(row) if row else None

    def list_radio_events(self, direction="", kind="", node="", limit=100):
        clauses, values = [], []
        if direction:
            clauses.append("direction=?")
            values.append(direction)
        if kind:
            clauses.append("kind=?")
            values.append(kind)
        if node:
            clauses.append("(origin=? OR destination=?)")
            values.extend([node, node])
        where = " WHERE " + " AND ".join(clauses) if clauses else ""
        values.append(limit)
        with self._lock:
            return [dict(row) for row in self._db.execute(
                "SELECT * FROM radio_events" + where + " ORDER BY created_at DESC,id DESC LIMIT ?", values
            )]

    def list_broadcasts(self, limit=100):
        with self._lock:
            return [dict(row) for row in self._db.execute(
                "SELECT b.*,COUNT(r.node) AS received_count FROM broadcasts b "
                "LEFT JOIN broadcast_receipts r ON r.broadcast_id=b.message_id "
                "GROUP BY b.message_id ORDER BY b.created_at DESC LIMIT ?", (limit,)
            )]

    def get_broadcast(self, message_id: int):
        with self._lock:
            row = self._db.execute("SELECT * FROM broadcasts WHERE message_id=?", (message_id,)).fetchone()
            if not row:
                return None
            result = dict(row)
            result["receipts"] = [dict(item) for item in self._db.execute(
                "SELECT node,received_at FROM broadcast_receipts WHERE broadcast_id=? ORDER BY received_at",
                (message_id,),
            )]
        result["received_count"] = len(result["receipts"])
        return result

    def list_safe_people(self, query="", limit=100):
        values = []
        where = ""
        if query:
            where = " WHERE name LIKE ? OR document LIKE ? OR place LIKE ? OR node LIKE ?"
            term = "%" + query + "%"
            values.extend([term] * 4)
        values.append(limit)
        with self._lock:
            return [dict(row) for row in self._db.execute(
                "SELECT * FROM safe_people" + where + " ORDER BY created_at DESC LIMIT ?", values
            )]

    def state(self) -> dict:
        with self._lock:
            requests = [dict(row) for row in self._db.execute(
                "SELECT *, created_at AS t, category AS cat, priority AS pri, place AS lugar, detail AS detalle, "
                "resource_node AS operador, state AS estado FROM requests ORDER BY priority,created_at"
            )]
            safe = [dict(row) for row in self._db.execute(
                "SELECT *, name AS nombre, document AS doc, place AS lugar, created_at AS t FROM safe_people "
                "ORDER BY created_at DESC"
            )]
            resources = [dict(row) for row in self._db.execute("SELECT * FROM resources ORDER BY node")]
            broadcasts = [dict(row) for row in self._db.execute(
                "SELECT b.*, COUNT(r.node) AS received_count FROM broadcasts b "
                "LEFT JOIN broadcast_receipts r ON r.broadcast_id=b.message_id "
                "GROUP BY b.message_id ORDER BY b.created_at DESC LIMIT 20"
            )]
        return {"requests": requests, "safe": safe, "resources": resources, "broadcasts": broadcasts}

    def close(self) -> None:
        with self._lock:
            self._db.close()
