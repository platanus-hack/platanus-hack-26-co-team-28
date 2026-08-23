#!/usr/bin/env python3
# ============================================================================
# sembrar_recursos.py · Precarga recursos simulados en el centro
# ----------------------------------------------------------------------------
# Estos recursos NO son placas LoRa reales. Son datos simulados, inyectados
# por el simulador del centro (--sim) con el MISMO formato de frame (HB+POS)
# que usaria una placa real: para el sistema son indistinguibles de un nodo
# LoRa real. El objetivo es que el demo muestre una flota completa (medico,
# rescate, incendio, agua) sin depender de tener 5+ placas fisicas.
#
# Diferencia con GRUA07: GRUA07 tiene un operador real detras (grua.html, un
# humano que acepta y avanza el estado por ACC/ST). Estos recursos son solo
# datos: si se despachan, nadie responde y quedan en DESPACHADA. El dashboard
# los marca con un badge "Simulado" para que no se confundan (ver app.js,
# RECURSOS_CON_OPERADOR).
#
# Un nodo LoRa real manda un latido (HB) periodico. Si el centro no sabe nada
# de un nodo hace mas de 10 min (triage.RESOURCE_MAX_AGE_SECONDS), deja de
# proponerlo como candidato: puede estar sin bateria o fuera de alcance. Por
# eso estos recursos tambien tienen que latir, si no desaparecen del despacho
# aunque la tabla de Recursos los siga mostrando como 'disponible'.
#
# USO:
#   python3 scripts/sembrar_recursos.py              (1 latido, caduca en 10 min)
#   python3 scripts/sembrar_recursos.py --mantener & (late cada 60 s, para el demo)
#   python3 scripts/sembrar_recursos.py --base http://127.0.0.1:8080
# ============================================================================
import argparse
import json
import time
import urllib.request
import urllib.error

# node, kind, zona, lat, lon — puntos reales de Bogota, repartidos por localidad
# para que el mapa se vea distribuido, no todos apilados en el mismo punto.
RECURSOS = [
    ("MEDICO01", "MEDICO", "CHAPINERO", "4.6486", "-74.0628"),
    ("MEDICO02", "MEDICO", "KENNEDY", "4.6280", "-74.1622"),
    ("RESCATE01", "RESCATE", "SUBA", "4.7423", "-74.0937"),
    ("RESCATE02", "RESCATE", "BOSA", "4.6229", "-74.1912"),
    ("FUEGO01", "FUEGO", "ENGATIVA", "4.7108", "-74.1173"),
    ("AGUA01", "AGUA", "USME", "4.5322", "-74.1258"),
]


def latir(base, seq):
    """Manda un HB+POS por cada recurso. Devuelve el siguiente numero de seq."""
    frames = []
    for node, kind, zona, lat, lon in RECURSOS:
        seq += 1
        frames.append("{}|CENTRO|HB|{}|{}|{}|-|1".format(node, seq, kind, zona))
        seq += 1
        frames.append("{}|CENTRO|POS|{}|{}|{}|10|0|disponible".format(node, seq, lat, lon))

    data = json.dumps({"frames": frames}).encode()
    req = urllib.request.Request(base + "/api/v1/simulator/frames", data=data,
                                 headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=8) as r:
        r.read()
    return seq


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--base", default="http://127.0.0.1:8080")
    p.add_argument("--mantener", action="store_true",
                   help="sigue latiendo cada --intervalo segundos (no termina)")
    p.add_argument("--intervalo", type=int, default=60,
                   help="segundos entre latidos con --mantener (default 60)")
    args = p.parse_args()
    base = args.base.rstrip("/")

    seq = int(time.time()) % 100000
    try:
        seq = latir(base, seq)
    except urllib.error.HTTPError as e:
        print("Error HTTP {}: {}".format(e.code, e.read().decode()))
        print("Recuerda arrancar el centro con --sim (el simulador debe estar activo).")
        return 1
    except Exception as e:  # noqa: BLE001
        print("No se pudo conectar a {}: {}".format(base, e))
        return 1

    print("{} recursos simulados sembrados en {}:".format(len(RECURSOS), base))
    for node, kind, zona, lat, lon in RECURSOS:
        print("  {} · {} · {} · {},{}".format(node, kind, zona, lat, lon))
    print("Recuerda: son datos, no una placa real. Si se despachan, nadie los acepta por ACC.")

    if not args.mantener:
        # Sin --mantener el triage los descarta a los 10 min (RESOURCE_MAX_AGE
        # _SECONDS): un nodo sin contacto reciente puede estar sin bateria o
        # fuera de alcance, y no se le debe despachar nada.
        print("")
        print("AVISO: un solo latido. En 10 min el triage dejara de proponerlos.")
        print("Para el demo, dejalos vivos:  python3 scripts/sembrar_recursos.py --mantener &")
        return 0

    print("")
    print("Latiendo cada {} s. Ctrl+C para parar.".format(args.intervalo))
    while True:
        try:
            time.sleep(args.intervalo)
            seq = latir(base, seq)
        except KeyboardInterrupt:
            print("\nDetenido. Los recursos caducan en 10 min sin latidos.")
            return 0
        except Exception as e:  # noqa: BLE001
            # El centro puede estar reiniciandose: reintenta en el proximo ciclo.
            print("latido fallido ({}), reintento en {} s".format(e, args.intervalo))


if __name__ == "__main__":
    raise SystemExit(main())
