#!/usr/bin/env bash
# ============================================================================
# desplegar_nodo.sh · Despliega un NODO LoRa rescatista con un solo comando
# ----------------------------------------------------------------------------
# Compila y sube el firmware 'nodo_portal_https' a una placa TTGO LoRa32.
# El nodo levanta un portal WiFi para que un telefono pida ayuda sin internet.
#
# USO:
#   bash scripts/desplegar_nodo.sh                 (autodetecta el puerto USB)
#   bash scripts/desplegar_nodo.sh /dev/cu.usbserial-59260043461
#
# Si no das puerto, el script busca el primer 'usbserial' con
# 'arduino-cli board list'. Si hay varios, los lista y te pide elegir.
# ============================================================================
set -euo pipefail

SKETCH="nodo_portal_https"
FQBN="esp32:esp32:ttgo-lora32:UploadSpeed=115200"
REPO="$(cd "$(dirname "$0")/.." && pwd)"

# Datos del portal que el rescatista debe conocer (fijos en el firmware).
SSID="AYUDA_AQUI_RESCATISTA_911"
IP_PORTAL="192.168.4.1"
DOMINIO="ayuda.homiapp.xyz"

# --- 1. Verifica el certificado TLS (no esta en git) -----------------------
if [ ! -f "$REPO/$SKETCH/credentials.h" ]; then
  echo "ERROR: falta el archivo $REPO/$SKETCH/credentials.h"
  echo "Ese archivo tiene el certificado TLS del portal HTTPS."
  echo "No esta en git por seguridad. Copialo desde otra maquina del equipo."
  echo "Sin ese archivo el firmware no compila. Abortando."
  exit 1
fi

# --- 2. Verifica que arduino-cli exista ------------------------------------
if ! command -v arduino-cli >/dev/null 2>&1; then
  echo "ERROR: no se encontro 'arduino-cli' en el PATH."
  echo "Instalalo antes de continuar: https://arduino.github.io/arduino-cli/"
  exit 1
fi

# --- 3. Resuelve el puerto USB ---------------------------------------------
PORT="${1:-}"

if [ -z "$PORT" ]; then
  echo ">> No diste puerto. Buscando placas con 'arduino-cli board list' ..."
  # Lista los puertos que contienen 'usbserial'.
  # Portable (funciona en bash 3.2 de macOS, sin 'mapfile').
  PUERTOS=()
  while IFS= read -r _p; do [ -n "$_p" ] && PUERTOS+=("$_p"); done \
    < <(arduino-cli board list | awk '/usbserial/ {print $1}')

  if [ "${#PUERTOS[@]}" -eq 0 ]; then
    echo "ERROR: no se encontro ningun puerto 'usbserial'."
    echo "Conecta la placa TTGO por USB y revisa el cable (debe ser de datos)."
    echo "Puertos vistos por arduino-cli:"
    arduino-cli board list
    exit 1
  elif [ "${#PUERTOS[@]}" -eq 1 ]; then
    PORT="${PUERTOS[0]}"
    echo ">> Puerto detectado: $PORT"
  else
    echo "Se encontraron varios puertos. Elige uno:"
    for i in "${!PUERTOS[@]}"; do
      echo "  [$i] ${PUERTOS[$i]}"
    done
    read -r -p "Numero de puerto: " IDX
    PORT="${PUERTOS[$IDX]:-}"
    if [ -z "$PORT" ]; then
      echo "ERROR: seleccion invalida. Abortando."
      exit 1
    fi
    echo ">> Puerto elegido: $PORT"
  fi
fi

if [ ! -e "$PORT" ]; then
  echo "ERROR: el puerto '$PORT' no existe."
  echo "Detecta los puertos disponibles con: arduino-cli board list"
  exit 1
fi

# --- 4. Compila y sube el firmware -----------------------------------------
echo ">> Compilando y subiendo '$SKETCH' a $PORT ..."
arduino-cli compile --upload -p "$PORT" --fqbn "$FQBN" "$REPO/$SKETCH"

# --- 5. Instrucciones finales ----------------------------------------------
echo ""
echo "========================================================"
echo " NODO RESCATISTA LISTO"
echo "========================================================"
echo " Red WiFi (SSID) : $SSID"
echo " IP del portal   : $IP_PORTAL"
echo " Dominio         : $DOMINIO"
echo "--------------------------------------------------------"
echo " El telefono debe conectarse a la red WiFi '$SSID'."
echo " Luego abre http://$IP_PORTAL o http://$DOMINIO en el navegador."
echo " Asi la persona pide ayuda sin internet."
echo "========================================================"
