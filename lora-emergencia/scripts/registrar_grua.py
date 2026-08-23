#!/usr/bin/env python3
# ============================================================================
# registrar_grua.py · Registra la grua del demo como recurso disponible
# ----------------------------------------------------------------------------
# En el demo la grua es el UNICO recurso fisico, y atiende 2 categorias: GRUA
# (su categoria propia, "via o vehiculo bloqueado") y RESCATE (maquinaria
# pesada para "persona atrapada"). El campo kind acepta varios valores
# separados por coma; triage.kind_matches() compara contra cualquiera de
# ellos. Corre esto UNA vez despues de arrancar center.py --sim.
#
# USO:
#   python3 scripts/registrar_grua.py                    (GRUA07, GRUA+RESCATE)
#   python3 scripts/registrar_grua.py --grua GRUA09 --kind GRUA
#   python3 scripts/registrar_grua.py --lat 4.677 --lon -74.048
# ============================================================================
import argparse
import json
import urllib.request
import urllib.error


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--base", default="http://127.0.0.1:8080")
    p.add_argument("--grua", default="GRUA07")
    p.add_argument("--kind", default="GRUA,RESCATE", help="categorias que atiende, separadas por coma")
    p.add_argument("--lat", default="4.6770")
    p.add_argument("--lon", default="-74.0485")
    args = p.parse_args()
    base = args.base.rstrip("/")

    frames = [
        "{}|CENTRO|HB|700|{}|CENTRO|-|1".format(args.grua, args.kind.upper()),
        "{}|CENTRO|POS|701|{}|{}|8|0|disponible".format(args.grua, args.lat, args.lon),
    ]
    data = json.dumps({"frames": frames}).encode()
    req = urllib.request.Request(base + "/api/v1/simulator/frames", data=data,
                                 headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=6) as r:
            body = r.read().decode()
    except urllib.error.HTTPError as e:
        print("Error HTTP {}: {}".format(e.code, e.read().decode()))
        print("Recuerda arrancar el centro con --sim (el simulador debe estar activo).")
        return 1
    except Exception as e:  # noqa: BLE001
        print("No se pudo conectar a {}: {}".format(base, e))
        return 1

    print("Grua registrada: {} (tipo {}) disponible en {},{}".format(
        args.grua, args.kind.upper(), args.lat, args.lon))
    print(body)
    print("Ahora un SOS de rescate podra despacharse a esta grua.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
