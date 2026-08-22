#!/usr/bin/env bash
# Lee el serial de una placa a 115200 baudios.
# Uso: ./scripts/monitor.sh <puerto>
# Ejemplo: ./scripts/monitor.sh /dev/cu.usbserial-59260068871
set -euo pipefail

PORT="${1:?Falta el puerto. Encuentralo con: arduino-cli board list}"

# Metodo 1: arduino-cli (preferido)
if command -v arduino-cli >/dev/null 2>&1; then
  arduino-cli monitor -p "$PORT" --config baudrate=115200
else
  # Metodo 2: stty + cat (fallback)
  stty -f "$PORT" 115200 raw -echo
  cat "$PORT"
fi
