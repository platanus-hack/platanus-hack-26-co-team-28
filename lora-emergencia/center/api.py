"""Versioned HTTP API for the offline command center."""

import time
from urllib.parse import unquote

from command_core import VALID_CATEGORIES, RadioFrame, clean_field
from triage import triage_request, triage_requests


REQUEST_STATES = {
    "PENDIENTE", "EN_REVISION", "ENVIANDO", "ENVIO_INDETERMINADO", "DESPACHADA",
    "ACEPTADA", "EN_CURSO", "RESUELTA", "CANCELADA",
}
RESOURCE_STATES = {"disponible", "reservado", "asignado", "enruta", "enlugar", "resuelta", "cancelada"}

# Estado que ve el CIUDADANO en su telefono/OLED, traducido del estado interno.
# El firmware es agnostico al texto (muestra lo que llega); el portal lo mapea a
# un paso del timeline. Fuente unica de verdad de los textos del ciudadano.
CITIZEN_STATUS = {
    "PENDIENTE": "RECIBIDA",
    "EN_REVISION": "EN GESTION",
    "DESPACHADA": "GRUA ASIGNADA",
    "ACEPTADA": "GRUA EN CAMINO",
    "EN_CURSO": "GRUA EN CAMINO",
    "RESUELTA": "RESUELTA",
    "CANCELADA": "CANCELADA",
}


class ApiError(ValueError):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status


def one(query, name, default=""):
    return query.get(name, [default])[0]


def bounded_limit(query, default=100, maximum=200):
    try:
        value = int(one(query, "limit", default))
    except (TypeError, ValueError):
        raise ApiError(400, "limit inválido")
    if value < 1:
        raise ApiError(400, "limit inválido")
    return min(value, maximum)


def numeric_id(value, label="id"):
    try:
        result = int(value)
    except (TypeError, ValueError):
        raise ApiError(400, label + " inválido")
    if result < 1:
        raise ApiError(400, label + " inválido")
    return result


def required_text(body, name, maximum, minimum=1):
    raw = body.get(name, "")
    if not isinstance(raw, str):
        raise ApiError(400, name + " inválido")
    value = clean_field(raw, maximum).strip()
    if len(value) < minimum:
        raise ApiError(400, name + " es requerido")
    return value


def optional_text(body, name, maximum, default=""):
    raw = body.get(name, default)
    if not isinstance(raw, str):
        raise ApiError(400, name + " inválido")
    return clean_field(raw, maximum).strip()


class CommandApi:
    def __init__(self, store, gateway, demo=False, notify=None, sim=False, center_position=None, public_demo=False):
        self.store = store
        self.gateway = gateway
        self.demo = demo
        self.public_demo = public_demo
        # sim: modo demo-con-hardware. Lee el gateway real (SOS del rescatista por
        # LoRa) pero permite simular el operador de grua sin 3ra placa fisica.
        self.sim = sim or demo
        self.notify = notify or (lambda: None)
        self.center_position = center_position
        if center_position is not None:
            self.store.set_center_position(center_position)

    def _request(self, request_id):
        request = self.store.get_request(request_id)
        if not request:
            raise ApiError(404, "solicitud no encontrada")
        return request

    def get(self, path, query):
        parts = [unquote(part) for part in path.split("/") if part]
        if parts == ["api", "v1", "overview"]:
            return self.overview()
        if parts == ["api", "v1", "requests"]:
            return self.requests(query)
        if len(parts) == 4 and parts[:3] == ["api", "v1", "requests"]:
            request = self._request(numeric_id(parts[3], "request id"))
            request["triage"] = triage_request(request, self.store.list_resources())
            return request
        if len(parts) == 5 and parts[:3] == ["api", "v1", "requests"] and parts[4] == "timeline":
            request_id = numeric_id(parts[3], "request id")
            self._request(request_id)
            return {"items": self.store.request_timeline(request_id)}
        if parts == ["api", "v1", "resources"]:
            return self.resources(query)
        if len(parts) == 4 and parts[:3] == ["api", "v1", "resources"]:
            node = clean_field(parts[3], 24)
            resource = self.store.get_resource(node)
            if not resource:
                raise ApiError(404, "recurso no encontrado")
            return resource
        if parts == ["api", "v1", "network"]:
            return self.network()
        if parts == ["api", "v1", "radio-events"]:
            return self.radio_events(query)
        if parts == ["api", "v1", "broadcasts"]:
            return {"items": self.store.list_broadcasts(bounded_limit(query))}
        if len(parts) == 4 and parts[:3] == ["api", "v1", "broadcasts"]:
            broadcast = self.store.get_broadcast(numeric_id(parts[3], "broadcast id"))
            if not broadcast:
                raise ApiError(404, "broadcast no encontrado")
            return broadcast
        if parts == ["api", "v1", "safe-people"]:
            query_text = clean_field(one(query, "q"), 80).strip()
            return {"items": self.store.list_safe_people(query_text, bounded_limit(query))}
        raise ApiError(404, "not found")

    def post(self, path, body):
        parts = [unquote(part) for part in path.split("/") if part]
        if len(parts) == 5 and parts[:3] == ["api", "v1", "requests"] and parts[4] == "dispatch":
            return self.dispatch(numeric_id(parts[3], "request id"), body)
        if len(parts) == 5 and parts[:3] == ["api", "v1", "requests"] and parts[4] == "actions":
            return self.action(numeric_id(parts[3], "request id"), body)
        if parts == ["api", "v1", "broadcasts"]:
            return self.broadcast(body)
        if parts == ["api", "v1", "center-position"]:
            return self.set_center_position(body)
        if parts in (["api", "v1", "simulator", "frames"], ["api", "v1", "simulator", "scenarios"]):
            if not self.sim:
                raise ApiError(404, "not found")
            return self.simulate(parts[-1], body)
        raise ApiError(404, "not found")

    def overview(self):
        resources = self.store.list_resources(limit=200)
        resource_counts = self.store.resource_counts()
        open_requests = triage_requests(
            self.store.list_requests(limit=None, open_only=True), self.store.list_resources()
        )
        radio = self.store.list_radio_events(limit=15)
        safe_people = self.store.list_safe_people(limit=10)
        return {
            "gateway": bool(self.gateway and self.gateway.connected),
            "center_position": self.store.get_center_position(),
            "demo": self.demo,
            "public_demo": self.public_demo,
            "metrics": {
                "critical": sum(item["triage"]["priority"] == 0 for item in open_requests),
                "pending": sum(item["state"] in {"PENDIENTE", "EN_REVISION", "ENVIO_INDETERMINADO"} for item in open_requests),
                "available_resources": resource_counts["available"],
                "open_requests": len(open_requests),
            },
            "requests": open_requests[:20],
            "safe_people": safe_people,
            "resources": resources,
            "resources_total": resource_counts["total"],
            "resources_truncated": resource_counts["total"] > len(resources),
            "recent_activity": radio,
        }

    def set_center_position(self, body):
        try:
            lat = float(body.get("lat"))
            lon = float(body.get("lon"))
            accuracy_raw = body.get("accuracy")
            accuracy = None if accuracy_raw in (None, "") else float(accuracy_raw)
        except (TypeError, ValueError):
            raise ApiError(400, "coordenadas inválidas")
        source = str(body.get("source", "")).upper()
        if not -90 <= lat <= 90 or not -180 <= lon <= 180:
            raise ApiError(400, "coordenadas fuera de rango")
        if accuracy is not None and (accuracy < 0 or accuracy > 100000):
            raise ApiError(400, "precisión inválida")
        if source not in {"NAVEGADOR", "MANUAL", "CONFIGURADA"}:
            raise ApiError(400, "fuente de ubicación inválida")
        position = {
            "lat": lat, "lon": lon, "accuracy": accuracy,
            "source": source, "label": "Centro de comando",
            "captured_at": time.time(),
        }
        self.store.set_center_position(position)
        self.center_position = position
        self.notify()
        return position

    def requests(self, query):
        state = clean_field(one(query, "state"), 24).upper()
        category = clean_field(one(query, "category"), 24).upper()
        priority_raw = one(query, "priority", "")
        if state and state not in REQUEST_STATES:
            raise ApiError(400, "state inválido")
        if category and category not in VALID_CATEGORIES:
            raise ApiError(400, "category inválida")
        priority = None
        if priority_raw != "":
            try:
                priority = int(priority_raw)
            except ValueError:
                raise ApiError(400, "priority inválida")
            if priority not in range(4):
                raise ApiError(400, "priority inválida")
        query_text = clean_field(one(query, "q"), 80).strip()
        resources = self.store.list_resources()
        items = self.store.list_requests(state, category, priority, query_text, bounded_limit(query))
        return {"items": triage_requests(items, resources), "count": len(items)}

    def resources(self, query):
        state = clean_field(one(query, "state"), 24).lower()
        kind = clean_field(one(query, "kind"), 24).upper()
        zone = clean_field(one(query, "zone"), 24).upper()
        if state and state not in RESOURCE_STATES:
            raise ApiError(400, "state inválido")
        if kind and kind not in VALID_CATEGORIES and kind != "RECURSO":
            raise ApiError(400, "kind inválido")
        return {"items": self.store.list_resources(state, kind, zone, bounded_limit(query))}

    def network(self):
        events = self.store.list_radio_events(limit=200)
        resources = self.store.list_resources(limit=200)
        resource_counts = self.store.resource_counts()
        return {
            "gateway": {"connected": bool(self.gateway and self.gateway.connected)},
            "nodes": resources,
            "totals": {
                "nodes": resource_counts["total"],
                "rx": sum(item["direction"] == "IN" for item in events),
                "tx": sum(item["direction"] == "OUT" for item in events),
            },
            "nodes_truncated": resource_counts["total"] > len(resources),
        }

    def radio_events(self, query):
        direction = clean_field(one(query, "direction"), 4).upper()
        kind = clean_field(one(query, "kind"), 24).upper()
        node = clean_field(one(query, "node"), 24)
        if direction and direction not in {"IN", "OUT"}:
            raise ApiError(400, "direction inválida")
        return {"items": self.store.list_radio_events(direction, kind, node, bounded_limit(query))}

    def _notify_citizen(self, request):
        # Cierra el loop bidireccional: transmite al rescatista el estado de SU
        # solicitud por LoRa (best-effort, sin exigir ACK). El rescatista lo
        # muestra en el OLED y en el portal (/status).
        # Frame: CENTRO|<nodo>|ST|<id>|<request_seq>|<estado>.
        if not self.gateway or not request:
            return
        node = request.get("node")
        estado = request.get("state")
        request_seq = request.get("seq")
        if not node or node == "CENTRO" or not estado or request_seq is None:
            return
        estado_ciudadano = CITIZEN_STATUS.get(estado, estado)
        try:
            frame = RadioFrame(
                "CENTRO", node, "ST", self.store.next_message_id(),
                (str(request_seq), str(estado_ciudadano)),
            )
            self.gateway.send_broadcast(frame, repeats=5)
        except Exception:
            pass

    def dispatch(self, request_id, body):
        resource = required_text(body, "resource_node", 24)
        actor = optional_text(body, "actor", 64, "operador") or "operador"
        reason = optional_text(body, "reason", 240)
        request = self._request(request_id)
        priority = triage_request(request, self.store.list_resources())["priority"]
        reserved = False
        previous_state = request["state"]
        try:
            frame, _request = self.store.reserve_dispatch(request_id, resource, priority)
            reserved = True
            if self.sim:
                # Operador simulado sin 3ra placa: transmite el DISP una vez para que
                # se vea en el aire (OLED/feed), pero no exige el ACK de una placa que
                # no existe. El operador respondera por la vista /grua (simulador).
                if self.gateway:
                    try:
                        self.gateway.send_reliable(frame, attempts=1, timeout=0.3)
                    except Exception:
                        pass
                delivered, result = True, "SIM_DELIVERED"
            else:
                delivered, result = self.gateway.send_reliable(frame) if self.gateway else (False, "GATEWAY_OFFLINE")
            if not delivered:
                raise ApiError(503, result)
            self.store.mark_dispatched(request_id, resource, frame, actor, reason)
            reserved = False
        finally:
            if reserved:
                self.store.release_dispatch(request_id, resource, previous_state)
        self._notify_citizen(self.store.get_request(request_id))
        self.notify()
        return {"ok": True, "message_id": frame.message_id, "effective_priority": priority}

    def action(self, request_id, body):
        action = required_text(body, "action", 16).lower()
        actor = required_text(body, "actor", 64)
        reason = required_text(body, "reason", 240, 3)
        try:
            request = self.store.request_action(request_id, action, actor, reason)
        except ValueError as exc:
            message = str(exc)
            raise ApiError(404 if message == "request not found" else 409, message)
        self._notify_citizen(request)
        self.notify()
        return {"ok": True, "request": request}

    def broadcast(self, body):
        message = required_text(body, "message", 80)
        scope_key = "scope" if "scope" in body else "audience"
        scope = optional_text(body, scope_key, 24, "ALL").upper()
        priority = optional_text(body, "priority", 12, "NORMAL").upper()
        try:
            expires_in = int(body.get("expires_in", 300))
        except (TypeError, ValueError):
            raise ApiError(400, "expires_in inválido")
        if scope != "ALL" and not scope.startswith("ZONE:"):
            raise ApiError(400, "scope inválido")
        if priority not in {"NORMAL", "URGENT"} or not 60 <= expires_in <= 86400:
            raise ApiError(400, "broadcast inválido")
        frame = RadioFrame(
            "CENTRO", "BCAST", "BC", self.store.next_message_id(),
            (scope, priority, str(int(time.time()) + expires_in), message),
        )
        self.store.start_broadcast(frame)
        try:
            sent = bool(self.gateway and self.gateway.send_broadcast(frame))
        except Exception:
            sent = False
        self.store.finish_broadcast(frame, sent)
        self.notify()
        if not sent:
            raise ApiError(503, "GATEWAY_OFFLINE")
        return {"ok": True, "message_id": frame.message_id}

    def simulate(self, kind, body):
        if kind == "scenarios":
            scenario = required_text(body, "scenario", 32)
            sequence = self.store.next_message_id()
            scenarios = {
                "critical-medical": [
                    "SIM-CIVIL|CENTRO|SOS|{}|MEDICO|2|4.6712|-74.0530|Centro|persona inconsciente".format(sequence)
                ],
                "rescue": [
                    "SIM-CIVIL|CENTRO|SOS|{}|RESCATE|2|4.6767|-74.0483|Norte|dos atrapados".format(sequence)
                ],
                "medical-resource": [
                    "SIM-MEDICO|CENTRO|HB|{}|MEDICO|CENTRO|-|1".format(sequence),
                    "SIM-MEDICO|CENTRO|POS|{}|4.6720|-74.0522|8|0|disponible".format(sequence + 1),
                ],
            }
            if scenario not in scenarios:
                raise ApiError(400, "scenario inválido")
            raw_frames = scenarios[scenario]
        else:
            raw_frames = body.get("frames", [body.get("frame", "")])
            if not isinstance(raw_frames, list) or not 1 <= len(raw_frames) <= 20:
                raise ApiError(400, "frames inválidos")
        results = []
        for raw in raw_frames:
            if not isinstance(raw, str) or len(raw) > 512:
                raise ApiError(400, "frame inválido")
            try:
                frame = RadioFrame.parse(raw)
            except ValueError as exc:
                raise ApiError(400, str(exc))
            if frame.destination != "CENTRO":
                raise ApiError(400, "frame debe dirigirse a CENTRO")
            results.append({"frame": frame.encode(), "result": self.store.ingest(frame, "-55", "8.5")})
            # Acciones del operador de grua (ACC/ST) llevan el nodo del ciudadano y su
            # secuencia en el payload. Al cambiar el estado, se lo notificamos al rescatista.
            if frame.kind in ("ACC", "ST") and len(frame.payload) >= 2:
                self._notify_citizen(self.store.get_request_by_node_seq(frame.payload[0], frame.payload[1]))
        self.notify()
        return {"ok": True, "results": results}
