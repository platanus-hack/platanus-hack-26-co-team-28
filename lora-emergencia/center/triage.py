"""Deterministic triage for LoRa emergency requests."""

from __future__ import annotations

import math
import re
import time
import unicodedata
from typing import List, Optional, Tuple


RESOURCE_MAX_AGE_SECONDS = 10 * 60

# Reglas de escalada de severidad. La severidad la asigna el CENTRO, no el
# ciudadano. Cada categoria es una SITUACION. Las frases van normalizadas
# (minusculas, sin acentos) porque el texto se pasa por normalize_text.
# GRUA = via o vehiculo bloqueado. NO incluye "atrapado" (eso es RESCATE): asi
# se elimina el solapamiento GRUA/RESCATE.
TRIAGE_RULES = {
    "MEDICO": (
        (0, ("inconsciente",), "persona inconsciente"),
        (0, ("no respira", "sin respirar"), "persona que no respira"),
        (0, ("hemorragia", "sangrado abundante"), "sangrado crítico"),
    ),
    "RESCATE": (
        (0, ("atrapado", "atrapada", "atrapados", "atrapadas"), "personas atrapadas"),
        (0, ("derrumbe", "bajo escombros"), "derrumbe"),
    ),
    "FUEGO": (
        (0, ("gente dentro", "personas dentro"), "personas dentro del incendio"),
        (0, ("olor a gas", "fuga de gas"), "riesgo de gas"),
    ),
    "AGUA": (
        (0, ("atrapado por el agua", "arrastrado por el agua"), "persona atrapada por el agua"),
    ),
    "GRUA": (
        (1, ("via bloqueada", "escombro en via", "arbol caido"), "vía bloqueada, retrasa el acceso"),
    ),
}


def normalize_text(value: object) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = "".join(character for character in text if not unicodedata.combining(character))
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def parse_coordinate(value: object, minimum: float, maximum: float) -> Optional[float]:
    try:
        coordinate = float(value)
    except (TypeError, ValueError):
        return None
    return coordinate if math.isfinite(coordinate) and minimum <= coordinate <= maximum else None


def request_location(request: dict) -> Optional[Tuple[float, float]]:
    lat = parse_coordinate(request.get("lat"), -90, 90)
    lon = parse_coordinate(request.get("lon"), -180, 180)
    return (lat, lon) if lat is not None and lon is not None else None


def distance_km(first: Tuple[float, float], second: Tuple[float, float]) -> float:
    lat1, lon1, lat2, lon2 = map(math.radians, (*first, *second))
    delta_lat = lat2 - lat1
    delta_lon = lon2 - lon1
    value = math.sin(delta_lat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(delta_lon / 2) ** 2
    value = min(1, max(0, value))
    return 6371 * 2 * math.atan2(math.sqrt(value), math.sqrt(1 - value))


def kind_matches(resource_kind: str, category: str) -> bool:
    """Un recurso puede declarar varias categorias que atiende, separadas por
    coma (ej: "GRUA,RESCATE" para una grua que tambien ayuda en rescates con
    maquinaria pesada). Compatible con el formato de un solo valor, sin coma."""
    kinds = {part.strip().upper() for part in str(resource_kind or "").split(",") if part.strip()}
    return category.upper() in kinds


def compatible_resources(request: dict, resources: List[dict], now: float) -> List[dict]:
    category = str(request.get("category", request.get("cat", ""))).upper()
    origin = request_location(request)
    candidates = []
    for resource in resources:
        if not kind_matches(resource.get("kind", ""), category) or resource.get("state") != "disponible":
            continue
        age = max(0, now - float(resource.get("last_seen", 0)))
        if age > RESOURCE_MAX_AGE_SECONDS:
            continue
        position_age = max(0, now - float(resource.get("position_seen_at", 0)))
        target = request_location(resource) if position_age <= RESOURCE_MAX_AGE_SECONDS else None
        distance = distance_km(origin, target) if origin and target else None
        candidates.append(
            {
                "node": resource.get("node"),
                "distance_km": round(distance, 2) if distance is not None else None,
                "last_seen_seconds": round(age),
            }
        )
    return sorted(
        candidates,
        key=lambda candidate: (
            candidate["distance_km"] is None,
            candidate["distance_km"] or 0,
            candidate["last_seen_seconds"],
            candidate["node"],
        ),
    )


def triage_request(request: dict, resources: List[dict], now: Optional[float] = None) -> dict:
    now = time.time() if now is None else now
    reported_priority = min(3, max(0, int(request.get("priority", request.get("pri", 2)))))
    category = str(request.get("category", request.get("cat", ""))).upper()
    text = normalize_text(f"{request.get('place', request.get('lugar', ''))} {request.get('detail', request.get('detalle', ''))}")
    signals = [
        (priority, reason)
        for priority, phrases, reason in TRIAGE_RULES.get(category, ())
        if any(phrase in text for phrase in phrases)
    ]
    effective_priority = min([reported_priority, *(priority for priority, _reason in signals)])
    escalation_reasons = [reason for priority, reason in signals if priority < reported_priority]
    reasons = (
        [f"Escalada por señal crítica: {reason}" for reason in dict.fromkeys(escalation_reasons)]
        if effective_priority < reported_priority
        else ["Prioridad crítica reportada por el nodo" if reported_priority == 0 else "Se conserva la prioridad reportada"]
    )
    location = request_location(request)
    alerts = []
    if not location:
        alerts.append("Sin coordenadas válidas")
    if not text:
        alerts.append("Sin lugar ni detalle")
    request_state = request.get("state", request.get("estado", "PENDIENTE"))
    is_pending = request_state in {"PENDIENTE", "EN_REVISION"} and not request.get("resource_node")
    candidates = compatible_resources(request, resources, now) if is_pending else []
    if is_pending and not candidates:
        alerts.append("Sin recursos compatibles disponibles y recientes")
    return {
        "priority": effective_priority,
        "reported_priority": reported_priority,
        "reasons": reasons,
        "alerts": alerts,
        "recommended_resource": candidates[0] if candidates else None,
        "candidates": candidates,
    }


def triage_requests(requests: List[dict], resources: List[dict], now: Optional[float] = None) -> List[dict]:
    now = time.time() if now is None else now
    triaged = []
    for request in requests:
        item = dict(request)
        item["triage"] = triage_request(item, resources, now)
        triaged.append(item)
    return sorted(triaged, key=lambda item: (item["triage"]["priority"], item.get("created_at", item.get("t", 0))))


# --- Cobertura: solape y vacio -------------------------------------------
# Las 2 fallas que el centro debe ver de un vistazo, medidas en desastres
# reales: equipos duplicados en un punto mientras otras zonas quedan solas.
# Aceh 2004 tuvo 653 agencias financiadoras + 564 ejecutoras sin coordinar;
# un centro de dialisis en Haiti opero al 20% "porque otros no sabian que
# existia". El 3W oficial de OCHA admite detectar solapamientos solo de forma
# superficial. Aqui se calcula sobre los datos que ya estan en SQLite.

# Radio del sector operativo. 300 m son ~3 cuadras en Bogota: 2 equipos
# dentro de ese radio trabajan el mismo punto.
SECTOR_RADIUS_KM = 0.3
# Solicitudes con un equipo ya trabajando en ellas.
ASSIGNED_STATES = {"DESPACHADA", "ACEPTADA", "EN_CURSO"}
# Solicitudes abiertas sin nadie en camino.
UNASSIGNED_STATES = {"PENDIENTE", "EN_REVISION", "ENVIO_INDETERMINADO"}


def cluster_by_proximity(locations: List[Tuple[float, float]], radius_km: float) -> List[List[int]]:
    """Agrupa puntos por cercania y devuelve los indices de cada grupo.

    Usa union-find, no un agrupado codicioso: 2 puntos lejanos entre si caen
    en el mismo grupo cuando un tercero los enlaza, y el resultado no depende
    del orden de entrada.
    """
    parent = list(range(len(locations)))

    def find(index: int) -> int:
        while parent[index] != index:
            parent[index] = parent[parent[index]]
            index = parent[index]
        return index

    for first in range(len(locations)):
        for second in range(first + 1, len(locations)):
            if distance_km(locations[first], locations[second]) <= radius_km:
                root_first, root_second = find(first), find(second)
                if root_first != root_second:
                    parent[max(root_first, root_second)] = min(root_first, root_second)

    groups: dict = {}
    for index in range(len(locations)):
        groups.setdefault(find(index), []).append(index)
    return [groups[key] for key in sorted(groups)]


def coverage_alerts(requests: List[dict], now: Optional[float] = None) -> dict:
    """Detecta esfuerzo duplicado y solicitudes sin nadie asignado.

    - solape: 2 o mas recursos DISTINTOS trabajando dentro del mismo sector.
      Un solo recurso con 2 solicitudes cercanas no es solape: es un equipo
      que atiende 2 casos vecinos, que es lo correcto.
    - vacio: solicitud abierta sin recurso asignado. Se ordena por espera,
      la mas vieja primero, porque esa es la que mas riesgo acumula.
    """
    now = time.time() if now is None else now
    ordered = sorted(requests, key=lambda item: item.get("id") or 0)

    working: List[dict] = []
    gaps: List[dict] = []
    for request in ordered:
        state = str(request.get("state", request.get("estado", ""))).upper()
        resource = request.get("resource_node")
        location = request_location(request)
        if resource and state in ASSIGNED_STATES and location:
            working.append({"request": request, "resource": resource, "location": location})
        elif not resource and state in UNASSIGNED_STATES:
            gaps.append(
                {
                    "request_id": request.get("id"),
                    "category": request.get("category", request.get("cat", "")),
                    "priority": request.get("priority", request.get("pri")),
                    "lat": request.get("lat", ""),
                    "lon": request.get("lon", ""),
                    "place": request.get("place", request.get("lugar", "")) or "",
                    "waiting_seconds": max(0, round(now - float(request.get("created_at") or now))),
                }
            )

    overlaps = []
    for group in cluster_by_proximity([item["location"] for item in working], SECTOR_RADIUS_KM):
        members = [working[index] for index in group]
        resources = sorted({member["resource"] for member in members})
        if len(resources) < 2:
            continue
        overlaps.append(
            {
                "resources": resources,
                "request_ids": [member["request"].get("id") for member in members],
                "lat": round(sum(member["location"][0] for member in members) / len(members), 5),
                "lon": round(sum(member["location"][1] for member in members) / len(members), 5),
                "radius_km": SECTOR_RADIUS_KM,
            }
        )

    gaps.sort(key=lambda item: -item["waiting_seconds"])
    return {"overlaps": overlaps, "gaps": gaps}
