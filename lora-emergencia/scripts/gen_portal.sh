#!/usr/bin/env bash
# Regenera portal_page.h desde portal_preview.html.
# El firmware incluye portal_page.h (los .h no pasan por el generador de
# prototipos de Arduino, que se confunde con las funciones JS del HTML).
# Uso:  bash scripts/gen_portal.sh
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)/nodo_portal_https"
SRC="$DIR/portal_preview.html"
OUT="$DIR/portal_page.h"

if [ ! -f "$SRC" ]; then
  echo "No existe $SRC"; exit 1
fi
# Verifica que el HTML no contenga la secuencia de cierre del raw string.
if grep -q ')HTML"' "$SRC"; then
  echo "ERROR: portal_preview.html contiene ')HTML\"', rompe el raw string de C++."; exit 1
fi
{
  printf '#pragma once\n'
  printf 'static const char PAGE_HTTPS[] = R"HTML('
  cat "$SRC"
  printf ')HTML";\n'
} > "$OUT"
echo "Generado $OUT ($(wc -c < "$OUT") bytes) desde portal_preview.html"
