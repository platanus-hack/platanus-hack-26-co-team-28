#!/usr/bin/env bash
# ============================================================================
# probar_portal.sh · Lanzador del validador del portal cautivo AYUDA
# ----------------------------------------------------------------------------
# Corre el validador e2e SIN necesidad de Claude Code. Un solo comando.
#
# COMO USARLO
#   1. Conecta esta computadora (Mac/PC/Linux) a la red WiFi:
#          AYUDA_AQUI_RESCATISTA_911   (abierta, sin contrasena)
#   2. Acepta el aviso "esta red no tiene internet". Quedate en la red.
#   3. Corre este script:
#          bash probar_portal.sh
#      o hazlo ejecutable una vez y luego:
#          chmod +x probar_portal.sh
#          ./probar_portal.sh
#
# QUE HACE
#   - Verifica que tengas python3.
#   - Verifica que el ESP32 responde en 192.168.4.1 (que estas en la red).
#   - Corre el validador de todos los sondeos de Android/iOS/Windows.
#   - Imprime PASS/FAIL y el veredicto final.
# ============================================================================
set -u

HOST="${1:-192.168.4.1}"
HTTPS_HOST="${2:-ayuda.homiapp.xyz}"
DIR="$(cd "$(dirname "$0")" && pwd)"
VALIDADOR="$DIR/validar_portal.py"

rojo()  { printf "\033[31m%s\033[0m\n" "$1"; }
verde() { printf "\033[32m%s\033[0m\n" "$1"; }
azul()  { printf "\033[34m%s\033[0m\n" "$1"; }

azul "== Validador del portal de emergencia AYUDA =="
echo

# 1. python3
PY="$(command -v python3 || true)"
if [ -z "$PY" ]; then
  rojo "No encuentro python3. Instalalo:"
  echo "   macOS:  brew install python3   (o descarga de python.org)"
  echo "   Linux:  sudo apt install python3"
  exit 1
fi
verde "python3 encontrado: $PY"

# 2. el validador existe
if [ ! -f "$VALIDADOR" ]; then
  rojo "No encuentro validar_portal.py junto a este script ($VALIDADOR)."
  exit 1
fi

# 3. estas en la red? el ESP32 responde en el puerto 80?
azul "Comprobando conexion con el ESP32 en $HOST ..."
if "$PY" - "$HOST" <<'PYEOF'
import socket, sys
host = sys.argv[1]
try:
    s = socket.create_connection((host, 80), timeout=3)
    s.close()
    sys.exit(0)
except Exception:
    sys.exit(1)
PYEOF
then
  verde "El ESP32 responde en $HOST:80. Estas en la red."
else
  rojo "No hay respuesta de $HOST:80."
  echo
  echo "Revisa esto:"
  echo "  1. Conectate a la red WiFi 'AYUDA_AQUI_RESCATISTA_911' (abierta)."
  echo "  2. Acepta el aviso 'la red no tiene internet' y QUEDATE en la red."
  echo "  3. Verifica que la placa este encendida (pantalla OLED: 'PUNTO AYUDA')."
  echo "  4. Vuelve a correr: bash probar_portal.sh"
  exit 1
fi

echo
azul "Corriendo el validador de sondeos (Android / iOS / Windows) ..."
echo
exec "$PY" "$VALIDADOR" --host "$HOST" --https-host "$HTTPS_HOST"
