#!/usr/bin/env bash

WOKI_ARDUINO_CLI_VERSION="1.5.1"
WOKI_ESP32_CORE_VERSION="3.3.11"
WOKI_RADIOLIB_VERSION="7.7.1"
WOKI_U8G2_VERSION="2.36.19"
WOKI_ESP32_INDEX="https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json"
WOKI_FQBN="esp32:esp32:ttgo-lora32:UploadSpeed=115200"

woki_log() {
  printf '\n>> %s\n' "$*"
}

woki_fail() {
  printf '\nERROR: %s\n' "$*" >&2
  exit 1
}

woki_require_command() {
  command -v "$1" >/dev/null 2>&1 || woki_fail "Falta '$1' en la laptop."
}

woki_tools_bin() {
  if [ -n "${WOKI_TOOLS_DIR:-}" ]; then
    printf '%s\n' "$WOKI_TOOLS_DIR"
    return
  fi
  printf '%s\n' "${XDG_DATA_HOME:-$HOME/.local/share}/woki/bin"
}

woki_ensure_arduino_cli() {
  local tools_bin
  tools_bin="$(woki_tools_bin)"

  if command -v arduino-cli >/dev/null 2>&1; then
    WOKI_ARDUINO_CLI="$(command -v arduino-cli)"
    return
  fi
  if [ -x "$tools_bin/arduino-cli" ]; then
    WOKI_ARDUINO_CLI="$tools_bin/arduino-cli"
    return
  fi

  woki_require_command curl
  mkdir -p "$tools_bin"
  woki_log "Instalando Arduino CLI $WOKI_ARDUINO_CLI_VERSION sin Arduino IDE"
  curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh \
    | env BINDIR="$tools_bin" sh -s "$WOKI_ARDUINO_CLI_VERSION"
  [ -x "$tools_bin/arduino-cli" ] || woki_fail "Arduino CLI no quedó instalado."
  WOKI_ARDUINO_CLI="$tools_bin/arduino-cli"
}

woki_arduino() {
  "$WOKI_ARDUINO_CLI" "$@"
}

woki_ensure_firmware_toolchain() {
  woki_ensure_arduino_cli
  woki_log "Preparando ESP32 y librerías WOKI; la primera vez puede tardar"

  woki_arduino config init >/dev/null 2>&1 || true
  if ! woki_arduino config dump 2>/dev/null | grep -Fq "$WOKI_ESP32_INDEX"; then
    woki_arduino config add board_manager.additional_urls "$WOKI_ESP32_INDEX"
  fi
  woki_arduino core update-index
  woki_arduino core install "esp32:esp32@$WOKI_ESP32_CORE_VERSION"
  woki_arduino lib install "RadioLib@$WOKI_RADIOLIB_VERSION"
  woki_arduino lib install "U8g2@$WOKI_U8G2_VERSION"
}

woki_confirm_antenna() {
  local answer
  if [ "${WOKI_ASSUME_YES:-0}" = "1" ]; then
    return
  fi
  [ -t 0 ] || woki_fail "Conecta primero la antena 915 MHz y vuelve a ejecutar en una terminal interactiva."
  printf '\nSEGURIDAD: nunca energices ni flashees la TTGO sin antena 915 MHz.\n'
  read -r -p "¿La antena ya está conectada? [s/N] " answer
  case "$answer" in
    s|S|si|SI|sí|SÍ) ;;
    *) woki_fail "Instalación cancelada. Conecta la antena antes de continuar." ;;
  esac
}

woki_select_port() {
  local requested="${1:-}"
  local selected=""
  local index=""
  local ports=()
  local item

  if [ -n "$requested" ]; then
    [ -e "$requested" ] || woki_fail "El puerto '$requested' no existe."
    printf '%s\n' "$requested"
    return
  fi

  woki_log "Buscando placas conectadas por USB" >&2
  while IFS= read -r item; do
    [ -n "$item" ] && ports+=("$item")
  done < <(woki_arduino board list | awk 'NR > 1 && $1 ~ /^\/dev\// { print $1 }')

  if [ "${#ports[@]}" -eq 0 ]; then
    woki_arduino board list >&2 || true
    woki_fail "No se detectó una placa. Revisa antena, cable de datos y driver USB."
  fi
  if [ "${#ports[@]}" -eq 1 ]; then
    printf '%s\n' "${ports[0]}"
    return
  fi

  [ -t 0 ] || woki_fail "Hay varias placas conectadas; pasa el puerto con --port."
  printf 'Se encontraron varias placas:\n' >&2
  for index in "${!ports[@]}"; do
    printf '  [%s] %s\n' "$index" "${ports[$index]}" >&2
  done
  read -r -p "Número de puerto: " index
  selected="${ports[$index]:-}"
  [ -n "$selected" ] || woki_fail "Selección inválida."
  printf '%s\n' "$selected"
}

woki_flash() {
  local sketch="$1"
  local port="$2"
  woki_log "Compilando y flasheando $(basename "$sketch") en $port"
  woki_arduino compile --upload --port "$port" --fqbn "$WOKI_FQBN" "$sketch"
}

woki_ensure_uv() {
  local tools_bin
  tools_bin="$(woki_tools_bin)"

  if command -v uv >/dev/null 2>&1; then
    WOKI_UV="$(command -v uv)"
    return
  fi
  if [ -x "$tools_bin/uv" ]; then
    WOKI_UV="$tools_bin/uv"
    return
  fi

  woki_require_command curl
  mkdir -p "$tools_bin"
  woki_log "Instalando uv para preparar Python sin modificar el Python del sistema"
  curl -LsSf https://astral.sh/uv/install.sh \
    | env UV_INSTALL_DIR="$tools_bin" UV_NO_MODIFY_PATH=1 sh
  [ -x "$tools_bin/uv" ] || woki_fail "uv no quedó instalado."
  WOKI_UV="$tools_bin/uv"
}
