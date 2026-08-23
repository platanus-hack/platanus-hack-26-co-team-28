#!/usr/bin/env bash
# Prepara una laptop macOS/Linux, flashea el LoRa Maestro y arranca el Centro real.
set -euo pipefail

LORA_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=lib/woki_install_common.sh
source "$LORA_ROOT/scripts/lib/woki_install_common.sh"

PORT=""
START_CENTER=1

usage() {
  cat <<'EOF'
Uso: bash lora-emergencia/scripts/instalar_maestro.sh [opciones]

Instala Arduino CLI, ESP32, RadioLib, U8g2 y Python; luego flashea
gateway_bidir y arranca el Centro real con una base persistente.

Opciones:
  --port RUTA   Puerto USB, por ejemplo /dev/cu.usbserial-XXXX
  --no-start    Prepara todo sin arrancar center.py
  --yes         Confirma que la antena 915 MHz ya está conectada
  -h, --help    Muestra esta ayuda
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --port) [ "$#" -ge 2 ] || woki_fail "--port necesita una ruta"; PORT="$2"; shift 2 ;;
    --no-start) START_CENTER=0; shift ;;
    --yes) WOKI_ASSUME_YES=1; shift ;;
    -h|--help) usage; exit 0 ;;
    /dev/*) PORT="$1"; shift ;;
    *) woki_fail "Opción desconocida: $1" ;;
  esac
done

printf 'WOKI · Instalación del LoRa Maestro\n'
woki_ensure_firmware_toolchain
woki_confirm_antenna
PORT="$(woki_select_port "$PORT")"
woki_flash "$LORA_ROOT/gateway_bidir" "$PORT"

woki_ensure_uv
VENV="$LORA_ROOT/center/.venv"
if [ ! -x "$VENV/bin/python" ]; then
  woki_log "Creando entorno Python del Centro"
  "$WOKI_UV" venv --python 3.12 "$VENV"
fi
"$WOKI_UV" pip install --python "$VENV/bin/python" -r "$LORA_ROOT/center/requirements.txt"

SYNC_FILE="${XDG_CONFIG_HOME:-$HOME/.config}/woki/center.env"
if [ ! -f "$SYNC_FILE" ] && [ -t 0 ]; then
  printf '\nLa sincronización online es opcional; el Centro funciona sin internet.\n'
  read -r -s -p "WOKI_SYNC_TOKEN entregado por el administrador (Enter para omitir): " WOKI_PRIVATE_SYNC_TOKEN
  printf '\n'
  if [ -n "$WOKI_PRIVATE_SYNC_TOKEN" ]; then
    mkdir -p "$(dirname "$SYNC_FILE")"
    chmod 700 "$(dirname "$SYNC_FILE")"
    umask 077
    {
      printf 'export WOKI_SYNC_URL=%q\n' "https://woki-hub.vercel.app/api/sync"
      printf 'export WOKI_SYNC_TOKEN=%q\n' "$WOKI_PRIVATE_SYNC_TOKEN"
    } > "$SYNC_FILE"
    chmod 600 "$SYNC_FILE"
  fi
fi

printf '\n========================================================\n'
printf ' MAESTRO LISTO · %s\n' "$PORT"
printf ' Dashboard: http://localhost:8080\n'
printf ' Base local persistente: %s\n' "$LORA_ROOT/center/center.db"
printf '========================================================\n'

if [ "$START_CENTER" -eq 0 ]; then
  printf 'Para arrancarlo después, repite este comando sin --no-start.\n'
  exit 0
fi

if [ -f "$SYNC_FILE" ]; then
  # Contiene solo variables exportadas por este instalador y está protegido con 0600.
  # shellcheck disable=SC1090
  source "$SYNC_FILE"
fi

woki_log "Arrancando el Centro; deja esta terminal abierta y detén con Ctrl+C"
exec "$VENV/bin/python" "$LORA_ROOT/center/center.py" "$PORT" \
  --host 127.0.0.1 --port 8080 --db "$LORA_ROOT/center/center.db"
