# Verificación de suficiencia física

## Dictamen

La definición ya es **suficiente para comprar componentes y hacer la primera
iteración física completa**. Todavía no es correcto llamarla lista para campo:
faltan confirmaciones y ensayos sobre el hardware real.

La solución evita tres riesgos de la versión inicial:

1. La Raspberry deja de montarse como PCB expuesta: usa carcasa y ventilación.
2. El nodo de campo no depende de que una impresión FDM sea impermeable.
3. Batería, conectores y pasamuros tienen referencias y compatibilidad explícita.

## Archivos CAD

| Pieza | Malla | Dimensión | Próximo paso |
|---|---|---:|---|
| `pantalla_marco` | Manifold | 170 × 129 × 3,2 mm | Confirmar etiqueta/cotas de pantalla |
| `pantalla_pie` | Manifold | 54 × 46 × 16 mm | Imprimir 2 y probar estabilidad |
| `centro_bandeja` | Manifold | 168 × 76 × 10,65 mm | Probar carcasa RPi4 y TTGO |
| `centro_powerbank` | Manifold | 161,2 × 72,2 × 7 mm | Probar Baseus exacta |
| `nodo_base` | Manifold | 72,2 × 42,2 × 20,5 mm | Solo demo; probar encaje |
| `nodo_tapa` | Manifold | 72,2 × 42,2 × 4 mm | Solo demo; probar retención |
| `bateria_placa` | Manifold | 94 × 58 × 3 mm | Solo demo; probar correa |
| `nodo_bandeja_ip68` | Manifold | 106 × 75 × 5 mm | Probar dentro de Hammond |

Cada pieza tiene STL y 3MF. El pie se imprime dos veces: el kit contiene nueve
objetos físicos a partir de ocho geometrías.

## Centro maestro

| Necesidad | Solución definida | Estado |
|---|---|---|
| Sostener pantalla | Marco Waveshare + dos pies | CAD; pantalla candidata |
| Proteger Raspberry | Carcasa oficial RPi4 | Compra definida |
| Refrigerar | Ventilador oficial + disipador | Compra definida |
| Integrar gateway | Dock TTGO de bandeja | CAD |
| Energía portátil | Baseus 65 W / 20 Ah + cuna | CAD + compra definida |
| Cablear táctil/radio | Dos USB-A → micro-USB de datos | Topología definida |
| Evitar bajo voltaje | USB-C 5 V/3 A y prueba bajo carga | Ensayo pendiente |

**Bloqueo físico restante:** fotografiar la etiqueta trasera de la pantalla o
comprobar envolvente 164,9 × 124,27 mm y patrón 148,9 × 114,96 mm. Si no coincide,
solo se rediseña `pantalla_marco`; el resto del centro se conserva.

## Nodo de campo

| Necesidad | Solución definida | Estado |
|---|---|---|
| Alojar TTGO + batería | Bandeja interna separada | CAD |
| Proteger de lluvia | Hammond 1554F2GYCL IP68 | Compra definida |
| Proteger SMA | Pasamuros Amphenol IP67 | Compra definida |
| Energía segura | Pack 1S protegido | Dos opciones definidas |
| Adaptar conector | Pigtail GH 1,25 mm, empalme y multímetro | Procedimiento definido |
| Transportar/fijar | Accesorios/pies externos Hammond o correa | Elegir según el despliegue |
| Validar autonomía | Prueba con WiFi AP + LoRa | Pendiente |

La carcasa mantiene su IP solo si el pasamuros se instala y sella correctamente.
El conjunto modificado no hereda automáticamente la certificación del fabricante.

## Pruebas de aceptación

### Ajuste

1. Componentes entran sin forzar PCB, batería o conectores.
2. Ninguna correa comprime el pouch o pasa sobre un botón/puerto.
3. HDMI, USB y coaxial conservan radio de giro y alivio de tensión.
4. El equipo no se desprende al invertirlo y agitarlo manualmente.

### Eléctrica y térmica

1. Ejecutar dos horas con dashboard, pantalla, táctil y TTGO activos.
2. Registrar `vcgencmd measure_temp` cada 10 minutos.
3. Ejecutar `vcgencmd get_throttled`; el valor esperado es `0x0`.
4. Revisar `dmesg` por bajo voltaje, USB o desconexiones serie.
5. Completar un ciclo de batería real y registrar horas, no estimarlas.

### Radio y entorno

1. Confirmar antena conectada antes de cada transmisión.
2. Comparar RSSI/SNR con caja abierta y cerrada.
3. Probar el pasamuros tirando suavemente del cable, nunca del SMA de la PCB.
4. Hacer salpicadura solo con electrónica de ensayo y la caja cerrada.

## Criterio de “suficiente”

- **Para imprimir:** sí; ocho mallas manifold verificadas.
- **Para comprar:** sí; BOM con referencias y sustituciones aceptables.
- **Para demo interior:** sí, después de una impresión y prueba eléctrica.
- **Para campo:** todavía no; requiere ajuste, autonomía, temperatura, radio y
  sellado verificados físicamente.
