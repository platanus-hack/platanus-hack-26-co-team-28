#!/usr/bin/env python3
# ============================================================================
# validar_loop_lora.py · Verificador del loop bidireccional con las 2 placas
# ----------------------------------------------------------------------------
# Prueba que el rescatista RECIBE por LoRa las notificaciones de estado que le
# manda el centro cuando el operador avanza la solicitud. Cierra el demo:
#   rescatista -> centro (SOS) ... centro -> rescatista (estado por LoRa).
#
# REQUISITOS:
#   - center.py corriendo con --sim y el gateway (placa CENTRO) conectado.
#   - La placa RESCATISTA conectada por USB (se lee su serial).
#
# USO:
#   python3 scripts/validar_loop_lora.py \
#       --rescatista /dev/cu.usbserial-59260043461 \
#       --base http://127.0.0.1:8080
#
# Inyecta un SOS del nodo del rescatista por el simulador del centro, dispara el
# ciclo del operador (despacho, ACC, en ruta, resuelta) y captura por serial que
# el rescatista reciba DESPACHADA, ACEPTADA, EN_CURSO y RESUELTA.
# ============================================================================
import argparse
import json
import threading
import time
import urllib.request

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
    except Exception as e:  # noqa: BLE001
        return 0, str(e)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--rescatista", default="/dev/cu.usbserial-59260043461")
    p.add_argument("--base", default="http://127.0.0.1:8080")
    p.add_argument("--node", default="a3f21c", help="NODE_ID del firmware del rescatista")
    p.add_argument("--seq", type=int, default=None, help="por defecto, uno unico por corrida")
    args = p.parse_args()
    base = args.base.rstrip("/")
    # seq unico por corrida para no chocar con una solicitud vieja del mismo nodo
    node = args.node
    seq = args.seq if args.seq is not None else int(time.time()) % 90000 + 1000

    def inject(frames):
        return http(base, "POST", "/api/v1/simulator/frames", {"frames": frames})

    # 0. el centro responde y tiene simulador
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
            if not ln:
                continue
            if "estado del centro" in ln:
                est = ln.split(":")[-1].strip()
                recibidos.append(est)
                print("  " + VERDE + "<<< RESCATISTA RECIBIO: " + est + FIN)

    th = threading.Thread(target=lector, daemon=True)
    th.start()

    print(AZUL + "== Validador del loop bidireccional (2 placas) ==" + FIN)
    print(GRIS + "Esperando boot del rescatista (~9 s)..." + FIN)
    time.sleep(9)

    print("1. registra grua + SOS del nodo {}".format(node))
    inject(["VAL-GRUA|CENTRO|HB|900|GRUA|CENTRO|-|1",
            "VAL-GRUA|CENTRO|POS|901|4.6505|-74.0602|8|0|disponible"])
    inject(["{}|CENTRO|SOS|{}|GRUA||4.6520|-74.0610|Cra 7|prueba loop".format(node, seq)])
    time.sleep(2)

    _, body = http(base, "GET", "/api/v1/requests")
    req_id = next((it["id"] for it in json.loads(body).get("items", [])
                   if it.get("node") == node and it.get("seq") == seq), None)
    if req_id is None:
        stop.set(); th.join(timeout=2); ser.close()
        print(ROJO + "No se creo la solicitud del nodo {}".format(node) + FIN)
        return 1

    pasos = [
        ("2. operador DESPACHA a la grua", lambda: http(base, "POST",
            "/api/v1/requests/{}/dispatch".format(req_id),
            {"resource_node": "VAL-GRUA", "actor": "val", "reason": "val"})),
        ("3. grua ACEPTA", lambda: inject(["VAL-GRUA|CENTRO|ACC|902|{}|{}".format(node, seq)])),
        ("4. grua EN RUTA", lambda: inject(["VAL-GRUA|CENTRO|ST|903|{}|{}|enruta".format(node, seq)])),
        ("5. grua RESUELVE", lambda: inject(["VAL-GRUA|CENTRO|ST|904|{}|{}|resuelta".format(node, seq)])),
    ]
    for titulo, accion in pasos:
        print("\n" + titulo)
        accion()
        time.sleep(4)

    stop.set(); th.join(timeout=2)
    ser.close()

    print("\n" + AZUL + "===== RESULTADO =====" + FIN)
    esperados = ["DESPACHADA", "ACEPTADA", "EN_CURSO", "RESUELTA"]
    faltan = [e for e in esperados if e not in recibidos]
    for e in esperados:
        ok = e in recibidos
        print("  [{}] rescatista recibio {}".format(VERDE + "PASS" + FIN if ok else ROJO + "FAIL" + FIN, e))
    if not faltan:
        print(VERDE + "\nTODO OK: el loop bidireccional funciona de punta a punta." + FIN)
        return 0
    print(ROJO + "\nFALTAN: {}".format(faltan) + FIN)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
