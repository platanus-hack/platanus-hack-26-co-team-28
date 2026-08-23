#!/usr/bin/env bash
# Prepara una laptop macOS/Linux y flashea un LoRa Esclavo de recurso.
set -euo pipefail

LORA_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=lib/woki_install_common.sh
source "$LORA_ROOT/scripts/lib/woki_install_common.sh"

PORT=""
RESOURCE_ID=""
RESOURCE_TYPE=""
RESOURCE_ZONE=""

usage() {
  cat <<'EOF'
Uso: bash lora-emergencia/scripts/instalar_esclavo.sh [opciones]

Instala Arduino CLI, ESP32 y las librerías; personaliza y flashea un
LoRa Esclavo de recurso sin modificar el firmware versionado.

Opciones:
  --port RUTA   Puerto USB, por ejemplo /dev/cu.usbserial-XXXX
  --id ID       Identificador único, por ejemplo GRUA07
  --type TIPO   Tipo de recurso, por ejemplo GRUA
  --zone ZONA   Zona operativa, por ejemplo NORTE
  --yes         Confirma que la antena 915 MHz ya está conectada
  -h, --help    Muestra esta ayuda
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --port) [ "$#" -ge 2 ] || woki_fail "--port necesita una ruta"; PORT="$2"; shift 2 ;;
    --id) [ "$#" -ge 2 ] || woki_fail "--id necesita un valor"; RESOURCE_ID="$2"; shift 2 ;;
    --type) [ "$#" -ge 2 ] || woki_fail "--type necesita un valor"; RESOURCE_TYPE="$2"; shift 2 ;;
    --zone) [ "$#" -ge 2 ] || woki_fail "--zone necesita un valor"; RESOURCE_ZONE="$2"; shift 2 ;;
    --yes) WOKI_ASSUME_YES=1; shift ;;
    -h|--help) usage; exit 0 ;;
    /dev/*) PORT="$1"; shift ;;
    *) woki_fail "Opción desconocida: $1" ;;
  esac
done

if [ -t 0 ]; then
  if [ -z "$RESOURCE_ID" ]; then read -r -p "ID único del recurso [GRUA07]: " RESOURCE_ID; fi
  if [ -z "$RESOURCE_TYPE" ]; then read -r -p "Tipo de recurso [GRUA]: " RESOURCE_TYPE; fi
  if [ -z "$RESOURCE_ZONE" ]; then read -r -p "Zona operativa [NORTE]: " RESOURCE_ZONE; fi
fi
RESOURCE_ID="${RESOURCE_ID:-GRUA07}"
RESOURCE_TYPE="${RESOURCE_TYPE:-GRUA}"
RESOURCE_ZONE="${RESOURCE_ZONE:-NORTE}"

case "$RESOURCE_ID" in *[!A-Z0-9_-]*|'') woki_fail "El ID solo admite A-Z, 0-9, _ y -." ;; esac
case "$RESOURCE_TYPE" in *[!A-Z0-9_-]*|'') woki_fail "El tipo solo admite A-Z, 0-9, _ y -." ;; esac
case "$RESOURCE_ZONE" in *[!A-Z0-9_-]*|'') woki_fail "La zona solo admite A-Z, 0-9, _ y -." ;; esac

printf 'WOKI · Instalación del LoRa Esclavo de recurso\n'
woki_ensure_firmware_toolchain
woki_confirm_antenna
PORT="$(woki_select_port "$PORT")"

WOKI_TEMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/woki-esclavo.XXXXXX")"
trap 'rm -rf "$WOKI_TEMP_DIR"' EXIT
mkdir -p "$WOKI_TEMP_DIR/nodo_recurso"
cp "$LORA_ROOT/nodo_recurso/nodo_recurso.ino" "$WOKI_TEMP_DIR/nodo_recurso/"
cp "$LORA_ROOT/nodo_recurso/portal_assets.h" "$WOKI_TEMP_DIR/nodo_recurso/"

sed -i.bak \
  -e "s/const char\* RESOURCE_ID = \"GRUA07\";/const char* RESOURCE_ID = \"$RESOURCE_ID\";/" \
  -e "s/const char\* RESOURCE_TYPE = \"GRUA\";/const char* RESOURCE_TYPE = \"$RESOURCE_TYPE\";/" \
  -e "s/String RESOURCE_ZONE = \"NORTE\";/String RESOURCE_ZONE = \"$RESOURCE_ZONE\";/" \
  "$WOKI_TEMP_DIR/nodo_recurso/nodo_recurso.ino"
rm -f "$WOKI_TEMP_DIR/nodo_recurso/nodo_recurso.ino.bak"

woki_flash "$WOKI_TEMP_DIR/nodo_recurso" "$PORT"

printf '\n========================================================\n'
printf ' ESCLAVO LISTO · %s · %s · %s\n' "$RESOURCE_ID" "$RESOURCE_TYPE" "$RESOURCE_ZONE"
printf ' WiFi local: RECURSO_%s\n' "$RESOURCE_ID"
printf ' Portal: http://192.168.4.1\n'
printf '========================================================\n'
