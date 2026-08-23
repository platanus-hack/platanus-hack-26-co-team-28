#!/usr/bin/env python3
# ============================================================================
# verificar_e2e.py · Verificador fuerte del flujo de emergencia de punta a punta
# ----------------------------------------------------------------------------
# Corre SIN Claude Code. Solo stdlib (urllib). Ejercita el camino del demo
# contra un centro VIVO (center.py --sim):
#
#   1. Registra una grua disponible (HB + POS).
#   2. El ciudadano pide ayuda por GRUA (via bloqueada). Sin severidad: la
#      asigna el centro (triage).
#   3. El centro muestra el pedido con su categoria y la severidad del triage.
#   4. Aislamiento: un pedido de RESCATE (persona atrapada) NO recomienda la
#      grua, y GRUA no escala por "atrapado". Se elimina el solapamiento.
#   5. Despacho a la grua -> DESPACHADA.
#   6. La grua acepta (ACC) -> ACEPTADA.
#   7. La grua va en ruta (ST enruta) -> EN_CURSO.
#   8. La grua resuelve (ST resuelta) -> RESUELTA.
#
# Cada paso imprime PASS/FAIL. Codigo de salida 0 si todo pasa, 1 si algo falla.
#
# USO:
#   python3 scripts/verificar_e2e.py                 (centro en 127.0.0.1:8080)
#   python3 scripts/verificar_e2e.py --base http://IP:8080
# El centro debe correr con --sim para exponer /api/v1/simulator/frames.
# ============================================================================
import argparse
import json
import sys
import time
import urllib.request
import urllib.error

VERDE = "\033[32m"
ROJO = "\033[31m"
AZUL = "\033[34m"
GRIS = "\033[90m"
FIN = "\033[0m"

fallos = 0
pasos = 0


def check(nombre, condicion, detalle=""):
    global fallos, pasos
    pasos += 1
    marca = VERDE + "PASS" + FIN if condicion else ROJO + "FAIL" + FIN
    linea = "  [{}] {}".format(marca, nombre)
    if detalle:
        linea += GRIS + "  ({})".format(detalle) + FIN
    print(linea)
    if not condicion:
        fallos += 1
    return condicion


def http(base, metodo, ruta, cuerpo=None):
    url = base + ruta
    datos = None
    cabeceras = {"Accept": "application/json"}
    if cuerpo is not None:
        datos = json.dumps(cuerpo).encode()
        cabeceras["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=datos, headers=cabeceras, method=metodo)
    try:
        with urllib.request.urlopen(req, timeout=8) as r:
            texto = r.read().decode("utf-8", "ignore")
            return r.status, (json.loads(texto) if texto else {})
    except urllib.error.HTTPError as e:
        texto = e.read().decode("utf-8", "ignore")
        try:
            return e.code, json.loads(texto)
        except ValueError:
            return e.code, {"raw": texto}
    except Exception as e:  # noqa: BLE001
        return 0, {"error": str(e)}


def inject(base, frames):
    return http(base, "POST", "/api/v1/simulator/frames", {"frames": frames})


def find_request(base, origin, category):
    # el nodo de origen se expone como "node" en la API del centro
    _, data = http(base, "GET", "/api/v1/requests", None)
    for item in data.get("items", []):
        if item.get("node") == origin and str(item.get("category")).upper() == category:
            return item
    return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="http://127.0.0.1:8080")
    args = parser.parse_args()
    base = args.base.rstrip("/")

    print(AZUL + "== Verificador e2e del flujo de emergencia ==" + FIN)
    print(GRIS + "centro: {}".format(base) + FIN)
    print()

    # ids unicos por corrida para no chocar con reportes viejos
    seed = int(time.time()) % 90000
    civil = "E2E-CIVIL{}".format(seed)
    civil_r = "E2E-RESC{}".format(seed)
    grua = "E2E-GRUA{}".format(seed)
    m = seed * 10  # base de message ids

    # 0. el centro responde y el simulador esta activo
    status, _ = http(base, "GET", "/api/v1/requests", None)
    if not check("el centro responde en /api/v1/requests", status == 200, "HTTP {}".format(status)):
        print(ROJO + "\nEl centro no responde. Arrancalo: python3 center/center.py <puerto> --sim" + FIN)
        return 1

    # 1. registra una grua disponible (HB + POS)
    st, res = inject(base, [
        "{}|CENTRO|HB|{}|GRUA|CENTRO|-|1".format(grua, m + 1),
        "{}|CENTRO|POS|{}|4.6505|-74.0602|8|0|disponible".format(grua, m + 2),
    ])
    check("registra grua disponible (HB+POS)", st == 200, "HTTP {}".format(st))
    _, recursos = http(base, "GET", "/api/v1/resources", None)
    grua_online = any(r.get("node") == grua and str(r.get("kind")).upper() == "GRUA"
                      for r in recursos.get("items", []))
    check("la grua aparece como recurso GRUA", grua_online)

    # 2. el ciudadano pide ayuda por GRUA (via bloqueada). pri vacio: lo asigna el centro
    st, res = inject(base, [
        "{}|CENTRO|SOS|{}|GRUA||4.6520|-74.0610|Cra 7 con 12|escombro en via".format(civil, m + 3),
    ])
    check("ingresa SOS de GRUA (sin severidad del ciudadano)", st == 200, "HTTP {}".format(st))

    # 3. el centro lo muestra con categoria y severidad del triage
    req = find_request(base, civil, "GRUA")
    check("el pedido GRUA aparece en el dashboard", req is not None)
    if req is None:
        return 1
    req_id = req["id"]
    tri = req.get("triage", {})
    check("categoria = GRUA", str(req.get("category")).upper() == "GRUA",
          "categoria={}".format(req.get("category")))
    check("la severidad la asigna el centro (triage.priority presente)",
          isinstance(tri.get("priority"), int),
          "priority={}".format(tri.get("priority")))
    check("el triage recomienda la grua (recurso compatible)",
          (tri.get("recommended_resource") or {}).get("node") == grua,
          "rec={}".format((tri.get("recommended_resource") or {}).get("node")))

    # 4. aislamiento: RESCATE (atrapado) NO usa la grua y escala a critica
    st, _ = inject(base, [
        "{}|CENTRO|SOS|{}|RESCATE||4.6702|-74.0510|Norte|persona atrapada".format(civil_r, m + 4),
    ])
    check("ingresa SOS de RESCATE (persona atrapada)", st == 200, "HTTP {}".format(st))
    reqr = find_request(base, civil_r, "RESCATE")
    check("el pedido RESCATE aparece", reqr is not None)
    if reqr is not None:
        trir = reqr.get("triage", {})
        check("RESCATE escala a critica (prioridad 0)", trir.get("priority") == 0,
              "priority={}".format(trir.get("priority")))
        rec = (trir.get("recommended_resource") or {}).get("node")
        check("RESCATE NO recomienda la grua (sin solapamiento)", rec != grua,
              "rec={}".format(rec))

    # 5. despacho de la grua al pedido GRUA -> DESPACHADA
    st, res = http(base, "POST", "/api/v1/requests/{}/dispatch".format(req_id),
                   {"resource_node": grua, "actor": "e2e", "reason": "verificador"})
    check("despacha la grua al pedido", st == 200, "HTTP {}".format(st))
    _, reqd = http(base, "GET", "/api/v1/requests/{}".format(req_id), None)
    check("estado = DESPACHADA", reqd.get("state") == "DESPACHADA",
          "state={}".format(reqd.get("state")))

    # 6. la grua acepta (ACC) -> ACEPTADA
    st, _ = inject(base, ["{}|CENTRO|ACC|{}|{}|{}".format(grua, m + 5, civil, m + 3)])
    check("la grua acepta (ACC)", st == 200, "HTTP {}".format(st))
    _, reqa = http(base, "GET", "/api/v1/requests/{}".format(req_id), None)
    check("estado = ACEPTADA", reqa.get("state") == "ACEPTADA",
          "state={}".format(reqa.get("state")))

    # 7. la grua va en ruta (ST enruta) -> EN_CURSO
    st, _ = inject(base, ["{}|CENTRO|ST|{}|{}|{}|enruta".format(grua, m + 6, civil, m + 3)])
    check("la grua reporta en ruta (ST enruta)", st == 200, "HTTP {}".format(st))
    _, reqe = http(base, "GET", "/api/v1/requests/{}".format(req_id), None)
    check("estado = EN_CURSO", reqe.get("state") == "EN_CURSO",
          "state={}".format(reqe.get("state")))

    # 8. la grua resuelve (ST resuelta) -> RESUELTA
    st, _ = inject(base, ["{}|CENTRO|ST|{}|{}|{}|resuelta".format(grua, m + 7, civil, m + 3)])
    check("la grua resuelve (ST resuelta)", st == 200, "HTTP {}".format(st))
    _, reqf = http(base, "GET", "/api/v1/requests/{}".format(req_id), None)
    check("estado = RESUELTA", reqf.get("state") == "RESUELTA",
          "state={}".format(reqf.get("state")))

    print()
    if fallos == 0:
        print(VERDE + "TODO OK: {}/{} verificaciones pasaron.".format(pasos, pasos) + FIN)
        return 0
    print(ROJO + "FALLARON {} de {} verificaciones.".format(fallos, pasos) + FIN)
    return 1


if __name__ == "__main__":
    sys.exit(main())
