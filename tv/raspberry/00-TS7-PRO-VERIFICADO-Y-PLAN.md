# TS7 Pro: especificaciones verificadas y plan de trabajo

Fecha: 21-11-2026. Fuentes: documentación oficial de SunFounder y el PDF de montaje oficial (enlaces al final). Lo que **no aparece** en esas fuentes está marcado como **NO CONSTA**.

## 1. Especificaciones oficiales

| Tema | Dato oficial | Fuente |
|---|---|---|
| Tamaño | 7" IPS, área visible 154,21 × 85,92 mm | hardware_introduction |
| Resolución nativa | 1024 × 600, 60 Hz | hardware_introduction |
| Entrada HDMI | Acepta de 640×480 a 1920×1200 (la reescala) | hardware_introduction |
| Brillo / ángulo | 300 cd/m², 170°, contraste 800:1, 5 ms | hardware_introduction |
| Táctil | Capacitivo de 5 puntos, **por USB** ("plug and play") | hardware_introduction |
| Video | **Solo HDMI**. No es DSI. | hardware_introduction + PDF |
| Audio | 2 parlantes de 8 Ω/2 W (el audio llega por HDMI) | hardware_introduction |
| Alimentación de la pantalla | 5 V DC, 3,5 W. Corriente del puerto: NO CONSTA | hardware_introduction |
| Botones | Power (reposo), Menú, +/− (volumen), Back (brillo) | hardware_introduction |
| Medidas | 165 × 114 × 40 mm (sin contar el soporte metálico de 55 mm). Peso: NO CONSTA | hardware_introduction |
| Montaje | Agujeros para colgar en la pared, para cámara CSI, para PiPower y para un disco de 2,5". **VESA: NO CONSTA** | hardware_introduction + PDF |
| Ventilación | La tapa acrílica trae una rejilla hexagonal. Ventilador o disipador: NO CONSTA | PDF |
| Precio | US$ 89,99 en la tienda oficial | Colección de SunFounder |

### Cómo se monta la Pi (según el PDF oficial)
- La Pi va **boca abajo** dentro de la placa trasera de la pantalla, encajada en un conector hembra de 40 pines. La pantalla toma la alimentación de la Pi por ese conector y deja los 40 pines libres para sensores.
- El video pasa por un **puente HDMI rígido** y el táctil por un **puente USB rígido**. La caja trae dos versiones de cada puente: **solo para Pi 3 y para Pi 4**.
- Para usarla como monitor externo, la caja trae además un cable HDMI, un cable micro-HDMI y cables micro-USB.
- La corriente entra **por el USB-C de la Pi** ("Power port of Raspberry Pi").

### ⚠️ Compatibilidad con la Pi 5: NO CONFIRMADA
- La tienda oficial anuncia la pantalla "para Raspberry Pi 4B/3B+/3B/Zero 2W". **La Pi 5 no figura**, aunque otras pantallas de 7" de la misma página sí la nombran.
- Ningún puente de la caja está hecho para la Pi 5. Lo que sigue lo **infiero yo** (está sin verificar): los micro-HDMI de la Pi 5 están en el mismo borde que en la Pi 4, pero los USB y el Ethernet están invertidos. Puede que el puente USB "Pi 4" no calce.
- Si los puentes no calzan, el plan B es usar los **cables sueltos que trae la caja** (micro-HDMI a HDMI y USB a micro-USB "Touch"). La Pi quedaría fuera del zócalo de 40 pines o sobre él, y la pantalla se alimentaría por su puerto micro-USB "Power".
- Hay tres riesgos más con la Pi 5, también sin verificar:
  1. **Refrigeración:** la Pi 5 necesita el Active Cooler y va boca abajo dentro de la carcasa. No sé si cabe.
  2. **Alimentación:** la Pi 5 pide 5 V / 5 A. Hay que comprobar que la pantalla, alimentada por los GPIO, no la deje corta.
  3. **Cámara CSI:** en la Pi 5 el conector es de 22 pines y necesita otro cable plano. Con la webcam USB este problema desaparece.

### Contradicción en la documentación
Una respuesta del FAQ dice "elige 1280x800", pero la ficha técnica dice que la resolución nativa es 1024×600. **Usamos 1024×600** para que la imagen salga nítida, y lo confirmaremos con `wlr-randr` en la pantalla real.

## 2. Qué implica para WOKI (cálculos verificables)
- **Lienzo:** 1920×1080 se reduce a 1024×600 con un factor de 0,533 (lo limita el ancho) y sobran 24 px de franja vertical. Un texto de 32 px en el lienzo queda en unos 17 px físicos. Esto se le pasa a la sesión de diseño.
- **Ángulo visual de la pantalla** (2·atan(medio ancho / distancia)):
  - a 50 cm: 17,5° × 9,8°
  - a 60 cm: 14,6° × 8,2°
  - a 70 cm: 12,6° × 7,0°
- **Conclusión preliminar:** la pantalla entera ocupa muy pocos grados. Las zonas para mirar tendrán que ser pocas y grandes. El número exacto sale de cruzar estos ángulos con el error medido en `../reports/Calibración eye tracking por webcam.md`, y lo decidimos con la sesión de diseño.
- **Brillo de 300 cd/m²:** alcanza para un dormitorio. En una pieza muy luminosa puede quedarse corto. Por las noches hay que bajarlo con el botón Back.

## 3. Plan de trabajo propuesto (corresponde a los 6 entregables del brief)

| # | Entregable | Archivo | Depende de |
|---|---|---|---|
| 0 | **Decidir la placa:** Pi 5 de 8 GB o Pi 4 de 4/8 GB (con la Pi 4 los puentes están garantizados) | este archivo | tu respuesta |
| 1 | Lista de materiales con links y precios (fuente, cooler, UPS, SSD/SD, webcam, brazo para la cama) | `01-BOM.md` | #0 |
| 2 | Guía de instalación: Bookworm, labwc, rotación con `wlr-randr`, táctil, kiosko de Chromium, sin salvapantallas, arranque directo | `02-INSTALACION.md` + `scripts/` | #0 |
| 3 | Servicios systemd + esqueleto de `woki-sensores` (bleak + gpiozero + luma.oled, WebSocket :8765) + watchdog de la alarma y "SIN CONEXIÓN" | `03-SERVICIOS.md` + `woki-sensores/` | — |
| 4 | Montaje físico: brazo, distancia de 50–70 cm, cámara cerca de la cara, BLE sin cables sobre el cuerpo (con AT-04-001 y FAQ de MyoWare), ventilación | `04-MONTAJE.md` | #0 |
| 5 | Prueba de fps de MediaPipe en Chromium y plan B (visión en Python o Hailo, punto enviado por WS) | `05-RENDIMIENTO.md` + `bench/` | #2 |
| 6 | Adaptación a 7": zonas, escala y qué cambia del lienzo (nota para la sesión de diseño) | `06-PANTALLA-7.md` | §2 + reporte de calibración |

Orden: primero #0. Después pueden ir en paralelo #3 y #6, que no dependen del hardware. Luego #1, #2 y #4, y al final #5, que necesita el aparato armado.

**No se compra nada ni se flashea ninguna tarjeta sin que lo confirmes.**

## Fuentes
- https://docs.sunfounder.com/projects/ts7-pro/en/latest/hardware_introduction.html
- https://docs.sunfounder.com/projects/ts7-pro/en/latest/
- https://docs.sunfounder.com/projects/ts7-pro/en/latest/faq.html
- https://docs.sunfounder.com/projects/ts7-pro/en/latest/resolution_orientation.html
- https://docs.sunfounder.com/projects/ts7-pro/en/latest/extension/extend_camera.html
- https://docs.sunfounder.com/projects/ts7-pro/en/latest/extension/extend_pipower.html
- PDF de montaje: https://github.com/sunfounder/sf-pdf/raw/master/assembly_file/a0000769-ts7-pro.pdf
- Ficha en la tienda: https://www.sunfounder.com/collections/displays-touchscreens-for-raspberry-pi (la página del producto devolvió HTTP 429 y no se pudo leer)

## 4. Hardware real según las fotos del 21-11-2026 (`fotos/`)

**Placa: Raspberry Pi 4 Model B** (no una Pi 5).
- Serigrafía "Raspberry Pi 4 Model B © 2018" y certificación "R-C-P2R-RPI4B" en el reverso.
- Va en una caja acrílica Vilros con ventilador y disipadores. El ventilador está conectado a los pines 5 V/GND del GPIO.
- Tiene una microSD de 64 GB puesta.
- **RAM: NO CONSTA** en las fotos (la Pi 4 existe con 1, 2, 4 y 8 GB). Se ve en el chip de RAM de la cara superior o con `free -h`.

**Pantalla: confirmada como SunFounder** (foto `fotos/2026-11-21-pantalla-placa-trasera.jpg`).
- Serigrafía: "SunFounder USB Capacitive Touch Screen 7-inch Touch Display Module 1024*600 HDMI LCD Panel". Placa "HCD-7inch-touch-V2.2", fechada 2022-2-15.
- Coincide con la ficha de la TS7 Pro: HDMI de tamaño completo, micro-USB "Touch" y "Power", 2 parlantes, 5 botones y un zócalo hembra de 40 pines para la Pi. Además trae un **conector macho de 40 pines que repite el GPIO** (rotulado pin a pin), que es donde se conectan los sensores.
- La palabra "TS7 Pro" no aparece impresa. Como las especificaciones coinciden, seguimos con las de la sección 1.
- Hay un tercer micro-USB al costado, cuya función NO CONSTA. No lo uses hasta verificarlo.

**Qué cambia:**
- El entregable #0 se resuelve casi solo: la Pi 4 es la placa para la que están hechos los puentes rígidos. El riesgo de compatibilidad con la Pi 5 deja de bloquear.
- Para encajar la Pi en el zócalo de la pantalla hay que sacarla de la caja Vilros. El ventilador ocupa pines del GPIO que el zócalo tapa, así que la refrigeración se tiene que resolver de otra forma.
- Es más probable que haga falta el plan B de visión (#5). La Pi 4 rinde bastante menos que la Pi 5, pero esto **se mide, no se supone**.
