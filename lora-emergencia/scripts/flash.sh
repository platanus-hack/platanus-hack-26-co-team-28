#!/usr/bin/env bash
# Compila y sube un firmware a una placa TTGO LoRa32.
# Uso: ./scripts/flash.sh <sketch> <puerto>
# Ejemplo: ./scripts/flash.sh nodo_tx /dev/cu.usbserial-59260043461
set -euo pipefail

SKETCH="${1:?Uso: flash.sh <sketch> <puerto>   (sketch: nodo_tx | gateway_rx | nodo_bidir | gateway_bidir)}"
PORT="${2:?Falta el puerto. Encuentralo con: arduino-cli board list}"

FQBN="esp32:esp32:ttgo-lora32:UploadSpeed=115200"
REPO="$(cd "$(dirname "$0")/.." && pwd)"

if [ ! -d "$REPO/$SKETCH" ]; then
  echo "No existe el sketch '$SKETCH' en $REPO"
  echo "Opciones: nodo_tx, gateway_rx, nodo_bidir, gateway_bidir"
  exit 1
fi

echo ">> Compilando y subiendo '$SKETCH' a $PORT ..."
arduino-cli compile --upload -p "$PORT" --fqbn "$FQBN" "$REPO/$SKETCH"
echo ">> Listo."
