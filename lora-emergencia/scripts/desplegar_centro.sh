#!/usr/bin/env bash
# ============================================================================
# desplegar_centro.sh · Despliega un CENTRO DE OPERACIONES con un solo comando
# ----------------------------------------------------------------------------
# Arranca center.py en modo simulador (--sim) con una base de datos NUEVA por
# corrida, para no arrastrar solicitudes viejas. Espera a que responda, y luego
# registra la grua del demo con registrar_grua.py. Al final imprime las URLs.
#
# El centro corre en PRIMER PLANO para que veas los logs en vivo.
# Se usa PYTHONUNBUFFERED=1 y 'python3 -u' para logs sin buffer.
# Para detener el centro: presiona Ctrl+C.
#
# USO:
#   bash scripts/desplegar_centro.sh                 (autodetecta el gateway)
#   bash scripts/desplegar_centro.sh /dev/cu.usbserial-59260068871
#
# Si no das puerto, el script busca el primer 'usbserial' con
# 'arduino-cli board list'. Si hay varios, los lista y te pide elegir.
# ============================================================================
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
HOST="127.0.0.1"
PORT_WEB="8080"
BASE="http://$HOST:$PORT_WEB"

# --- 1. Verifica python3 y pyserial -----------------------------------------
if ! command -v python3 >/dev/null 2>&1; then
  echo "ERROR: no se encontro 'python3' en el PATH. Instalalo antes de continuar."
  exit 1
fi

if ! python3 -c "import serial" >/dev/null 2>&1; then
  echo "ERROR: falta el modulo 'pyserial'."
  echo "Instalalo con: pip install pyserial"
  exit 1
fi

# --- 2. Verifica que el puerto web 8080 este libre --------------------------
if lsof -nP -iTCP:"$PORT_WEB" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "ERROR: el puerto $PORT_WEB ya esta ocupado."
  echo "Otro proceso escucha en $BASE. Cierralo antes de continuar."
  echo "Para ver quien lo usa: lsof -nP -iTCP:$PORT_WEB -sTCP:LISTEN"
  exit 1
fi

# --- 3. Resuelve el puerto del gateway LoRa ---------------------------------
GATEWAY="${1:-}"

if [ -z "$GATEWAY" ]; then
  echo ">> No diste puerto del gateway. Buscando con 'arduino-cli board list' ..."
  if ! command -v arduino-cli >/dev/null 2>&1; then
    echo "ERROR: no se encontro 'arduino-cli' para autodetectar el puerto."
    echo "Pasa el puerto a mano: bash scripts/desplegar_centro.sh <puerto>"
    exit 1
  fi
  # Portable (funciona en bash 3.2 de macOS, sin 'mapfile').
  PUERTOS=()
  while IFS= read -r _p; do [ -n "$_p" ] && PUERTOS+=("$_p"); done \
    < <(arduino-cli board list | awk '/usbserial/ {print $1}')

  if [ "${#PUERTOS[@]}" -eq 0 ]; then
    echo "ERROR: no se encontro ningun puerto 'usbserial' para el gateway."
    echo "Conecta la placa gateway por USB y revisa el cable (debe ser de datos)."
    echo "Puertos vistos por arduino-cli:"
    arduino-cli board list
    exit 1
  elif [ "${#PUERTOS[@]}" -eq 1 ]; then
    GATEWAY="${PUERTOS[0]}"
    echo ">> Gateway detectado: $GATEWAY"
  else
    echo "Se encontraron varios puertos. Elige el del gateway:"
    for i in "${!PUERTOS[@]}"; do
      echo "  [$i] ${PUERTOS[$i]}"
    done
    read -r -p "Numero de puerto: " IDX
    GATEWAY="${PUERTOS[$IDX]:-}"
    if [ -z "$GATEWAY" ]; then
      echo "ERROR: seleccion invalida. Abortando."
      exit 1
    fi
    echo ">> Gateway elegido: $GATEWAY"
  fi
fi

if [ ! -e "$GATEWAY" ]; then
  echo "ERROR: el puerto del gateway '$GATEWAY' no existe."
  echo "Detecta los puertos disponibles con: arduino-cli board list"
  exit 1
fi

# --- 4. Base de datos nueva por corrida (marca de tiempo) -------------------
STAMP="$(date +%Y%m%d_%H%M%S)"
# En center/ para que quede cubierta por el .gitignore (center/*.db).
DB="$REPO/center/center_${STAMP}.db"
echo ">> Base de datos nueva: $DB"

# --- 5. Arranca el centro en segundo plano temporal para esperar el arranque -
# Corremos el centro en background solo para poder esperar a que responda y
# registrar la grua. Al final lo traemos a primer plano con 'wait' para que
# el usuario vea los logs y pueda detenerlo con Ctrl+C.
echo ">> Arrancando el centro (gateway $GATEWAY, $BASE) ..."
PYTHONUNBUFFERED=1 python3 -u "$REPO/center/center.py" "$GATEWAY" \
  --sim --host "$HOST" --port "$PORT_WEB" --db "$DB" &
CENTER_PID=$!

# Si el script muere, baja tambien el centro.
trap 'kill "$CENTER_PID" 2>/dev/null || true' EXIT

# --- 6. Espera a que el centro responda -------------------------------------
echo ">> Esperando a que el centro responda en $BASE ..."
LISTO=0
for _ in $(seq 1 30); do
  # Si el proceso murio, aborta.
  if ! kill -0 "$CENTER_PID" 2>/dev/null; then
    echo "ERROR: el centro se detuvo durante el arranque. Revisa los logs de arriba."
    exit 1
  fi
  if curl -s -o /dev/null "$BASE" 2>/dev/null; then
    LISTO=1
    break
  fi
  sleep 1
done

if [ "$LISTO" -ne 1 ]; then
  echo "ERROR: el centro no respondio en $BASE tras 30 segundos."
  exit 1
fi
echo ">> El centro responde."

# --- 7. Registra la grua del demo -------------------------------------------
echo ">> Registrando la grua del demo ..."
python3 "$REPO/scripts/registrar_grua.py" --base "$BASE" || \
  echo "AVISO: no se pudo registrar la grua. Registrala luego con scripts/registrar_grua.py"

# --- 8. URLs y paso a primer plano ------------------------------------------
echo ""
echo "========================================================"
echo " CENTRO DE OPERACIONES LISTO"
echo "========================================================"
echo " Dashboard         : http://localhost:$PORT_WEB"
echo " Operador de grua  : http://localhost:$PORT_WEB/grua"
echo "--------------------------------------------------------"
echo " Base de datos     : $DB"
echo " Gateway LoRa      : $GATEWAY"
echo "--------------------------------------------------------"
echo " Los logs del centro salen abajo. Para detener: Ctrl+C."
echo "========================================================"
echo ""

# Trae el centro a primer plano. Los logs siguen saliendo hasta Ctrl+C.
wait "$CENTER_PID"
