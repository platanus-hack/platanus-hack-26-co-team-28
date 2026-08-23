# WOKI · módulos físicos

El sistema necesita dos equipos, no una colección abierta de accesorios.

## 1. Centro maestro

| Elemento | Selección | Integración mecánica |
|---|---|---|
| Computador | Raspberry Pi 4 Model B | Carcasa oficial + ventilador oficial; sujeta con dos correas a `centro_bandeja` |
| Pantalla | Candidata Waveshare 7inch HDMI LCD (C) | `pantalla_marco` + 2 × `pantalla_pie` |
| Radio maestro | TTGO T3 V1.6.1, 915 MHz | Dock de `centro_bandeja` |
| Energía móvil | Baseus Adaman 65 W, 20.000 mAh | `centro_powerbank` + dos correas |
| Antena | SMA 915 MHz incluida | Exterior, siempre conectada antes de transmitir |

### Cableado del centro

```text
Power bank USB-C ──────────────> USB-C de Raspberry Pi 4 (5 V / 3 A)
Raspberry micro-HDMI ──────────> HDMI estándar de pantalla
Raspberry USB-A ───────────────> micro-USB de pantalla (táctil + 5 V)
Raspberry USB-A ───────────────> micro-USB TTGO (datos serie + 5 V)
```

La pantalla requiere 500 mA y el límite total oficial de periféricos USB de la
Raspberry Pi 4 es 1,2 A. Pantalla y TTGO deben probarse juntos bajo carga. Si hay
avisos de bajo voltaje se debe usar un hub USB alimentado, no improvisar un cable
en Y. El power bank seleccionado entrega 5 V/3 A por USB-C.

### Piezas del centro

| Pieza | Medida exterior | Cantidad | Rol |
|---|---:|---:|---|
| `pantalla_marco` | 170 × 129 × 3,2 mm | 1 | Marco trasero ventilado; patrón 148,9 × 114,96 mm |
| `pantalla_pie` | 54 × 46 × 16 mm | 2 | Soporte de mesa con inclinación de 12° |
| `centro_bandeja` | 168 × 76 × 10,65 mm | 1 | Carcasa RPi4 por correas + dock TTGO |
| `centro_powerbank` | 161,2 × 72,2 × 7 mm | 1 | Cuna abierta para batería central |

`pantalla_marco` supone la Waveshare candidata. Antes de imprimir se debe
confirmar la etiqueta posterior o medir 164,9 × 124,27 mm de envolvente y
148,9 × 114,96 mm entre centros. No bloquea HDMI, micro-USB ni el interruptor.

## 2. Nodo de campo

| Elemento | Selección | Integración mecánica |
|---|---|---|
| Radio | TTGO T3 V1.6.1, 915 MHz | Bandeja interna, lado independiente |
| Batería | 3,7 V 1S protegida, 2.000 o 4.400 mAh | Correa separada; nunca comprimir |
| Envolvente | Hammond 1554F2GYCL, policarbonato | Caja comercial IP68 de 119 × 89 × 61 mm |
| Antena exterior | SMA 915 MHz | Pigtail Amphenol IP67 a pasamuros |
| Transporte | Pies/pole-mount Hammond o correa exterior | No perforar fuera del plan de sellado |

### Dos configuraciones deliberadas

- `nodo_base` + `nodo_tapa` + `bateria_placa`: demo interior, accesible y rápida.
- `nodo_bandeja_ip68` dentro de Hammond 1554F2GYCL: candidato para campo.

La bandeja IP68 mide 106 × 75 × 5 mm, usa el patrón nominal de insertos M3 de
100 × 68 mm y separa TTGO y batería. La caja admite 54,5 mm de altura interior;
un pack de 69 × 37 × 18 mm cabe junto a la placa, pero debe probarse físicamente.

## 3. Decisiones de energía

### Nodo

- Ligero: LiPo protegida Adafruit 2.000 mAh, 60 × 36 × 7 mm.
- Mayor autonomía: Li-ion protegida Adafruit 4.400 mAh, 69 × 37 × 18 mm.
- El conector de esas baterías es JST-PH 2,0 mm; el TTGO usa JST-GH 1,25 mm.
  Se utiliza el pigtail incluido por LILYGO, con empalme aislado y polaridad
  verificada con multímetro antes de conectar.
- No usar celdas 18650 sueltas, baterías sin protección ni paquetes hinchados.

La autonomía no se promete a partir de la capacidad nominal. Debe medirse con
portal WiFi, OLED y radio LoRa en el patrón operativo real.

### Centro

El power bank Baseus de 74 Wh da margen para la Raspberry, la pantalla y el TTGO,
pero la autonomía debe medirse. Conectar todo antes de encender, ya que cambiar
la carga de una fuente USB-PD multipuerto puede renegociar la alimentación.
