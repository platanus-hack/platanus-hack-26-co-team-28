#!/usr/bin/env python3
# ============================================================================
# validar_loop_lora.py · Verificador del demo completo con las 2 placas
# ----------------------------------------------------------------------------
# Valida el flujo de punta a punta con hardware real:
#   1. El rescatista envia un SOS (aqui se dispara por serial, en el demo lo
#      manda el telefono por el portal).
#   2. El centro lo recibe y le avisa "RECIBIDA" al rescatista (automatico).
#   3. El operador TOMA LA TAREA -> "EN GESTION".
#   4. El operador SOLICITA la grua -> "GRUA ASIGNADA".
#   5. La grua ACEPTA y va en ruta -> "GRUA EN CAMINO".
#   6. La grua RESUELVE -> "RESUELTA".
# Verifica que el rescatista RECIBA los 5 estados por LoRa (OLED + /status).
#
# Nota de demo: la grua se registra como recurso de tipo RESCATE (la unidad de
# maquinaria pesada que atiende rescates), para que el candado de compatibilidad
# del centro permita despacharla a un rescate.
#
# REQUISITOS: center.py con --sim y el gateway conectado; la placa RESCATISTA por USB.
# USO: python3 scripts/validar_loop_lora.py [--rescatista PUERTO] [--base URL]
# ============================================================================
import argparse
import json
import threading
import time
import urllib.request
import urllib.error

try:
    import serial
except ImportError:
    raise SystemExit("Falta pyserial. Instala: pip install pyserial")

VERDE = "\033[32m"; ROJO = "\033[31m"; AZUL = "\033[34m"; GRIS = "\033[90m"; FIN = "\033[0m"


def http(base, method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json"} if data else {}
    req = urllib.request.Request(base + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=6) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()
    except Exception as e:  # noqa: BLE001
        return 0, str(e)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--rescatista", default="/dev/cu.usbserial-59260043461")
    p.add_argument("--base", default="http://127.0.0.1:8080")
    p.add_argument("--node", default="a3f21c", help="NODE_ID del firmware del rescatista")
    p.add_argument("--grua", default="GRUA07", help="nodo de la grua (recurso)")
    args = p.parse_args()
    base = args.base.rstrip("/")
    node, grua = args.node, args.grua

    def inject(frames):
        return http(base, "POST", "/api/v1/simulator/frames", {"frames": frames})

    st, _ = http(base, "GET", "/api/v1/requests")
    if st != 200:
        print(ROJO + "El centro no responde en {} (arrancalo con --sim)".format(base) + FIN)
        return 1

    recibidos = []
    stop = threading.Event()
    ser = serial.Serial(args.rescatista, 115200, timeout=1)
    ser.setDTR(False); ser.setRTS(True); time.sleep(0.1); ser.setRTS(False)  # reset

    def lector():
        while not stop.is_set():
            try:
                ln = ser.readline().decode("utf-8", "ignore").rstrip()
            except Exception:
                break
            if ln and "estado del centro" in ln:
                est = ln.split(":")[-1].strip()
                recibidos.append(est)
                print("  " + VERDE + "<<< RESCATISTA RECIBIO: " + est + FIN)

    threading.Thread(target=lector, daemon=True).start()

    print(AZUL + "== Validador del demo completo (2 placas) ==" + FIN)
    print(GRIS + "Esperando boot del rescatista (~9 s)..." + FIN)
    time.sleep(9)

    # Grua como recurso RESCATE (unidad que atiende rescates), disponible y cercana.
    print("1. registra la grua {} como recurso RESCATE".format(grua))
    inject(["{}|CENTRO|HB|700|RESCATE|CENTRO|-|1".format(grua),
            "{}|CENTRO|POS|701|4.6770|-74.0485|8|0|disponible".format(grua)])
    time.sleep(1)

    print("2. el rescatista envia un SOS (persona atrapada bajo escombros)")
    ser.write(b"SOS|RESCATE|persona atrapada bajo escombros\n")
    ser.flush()
    time.sleep(6)  # envio + ACK + aviso automatico RECIBIDA

    _, body = http(base, "GET", "/api/v1/requests")
    reqs = sorted([it for it in json.loads(body).get("items", []) if it.get("node") == node],
                  key=lambda x: x["id"])
    if not reqs:
        stop.set(); ser.close()
        print(ROJO + "No se creo la solicitud del nodo {}".format(node) + FIN)
        return 1
    req = reqs[-1]
    rid, seq = req["id"], req["seq"]
    print(GRIS + "   solicitud id={} seq={} categoria={}".format(rid, seq, req["category"]) + FIN)

    pasos = [
        ("3. el operador TOMA LA TAREA", lambda: http(base, "POST",
            "/api/v1/requests/{}/actions".format(rid), {"action": "review", "actor": "val", "reason": "tomando"})),
        ("4. el operador SOLICITA la grua", lambda: http(base, "POST",
            "/api/v1/requests/{}/dispatch".format(rid), {"resource_node": grua, "actor": "val", "reason": "solicito grua"})),
        ("5. la grua ACEPTA", lambda: inject(["{}|CENTRO|ACC|702|{}|{}".format(grua, node, seq)])),
        ("6. la grua va EN RUTA", lambda: inject(["{}|CENTRO|ST|703|{}|{}|enruta".format(grua, node, seq)])),
        ("7. la grua RESUELVE", lambda: inject(["{}|CENTRO|ST|704|{}|{}|resuelta".format(grua, node, seq)])),
    ]
    for titulo, accion in pasos:
        print("\n" + titulo)
        code = accion()[0]
        if code not in (200, 0):
            print(ROJO + "   la accion devolvio HTTP {}".format(code) + FIN)
        time.sleep(4)

    stop.set(); time.sleep(0.3); ser.close()

    print("\n" + AZUL + "===== RESULTADO =====" + FIN)
    # Los textos salen de CITIZEN_STATUS en center/api.py. Si se tocan alli,
    # hay que tocarlos aqui: este validador se quedo con los viejos ("GRUA
    # ASIGNADA", "GRUA EN CAMINO") y habria dado FAIL sobre hardware bueno.
    esperados = ["RECIBIDA", "EN GESTION", "ESPERANDO UNIDAD", "UNIDAD ASIGNADA", "EN CAMINO", "RESUELTA"]
    faltan = [e for e in esperados if e not in recibidos]
    for e in esperados:
        ok = e in recibidos
        print("  [{}] rescatista recibio '{}'".format(
            VERDE + "PASS" + FIN if ok else ROJO + "FAIL" + FIN, e))
    if not faltan:
        print(VERDE + "\nTODO OK: el demo bidireccional funciona de punta a punta." + FIN)
        return 0
    print(ROJO + "\nFALTAN: {}".format(faltan) + FIN)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
