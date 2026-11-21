# Traspaso · Sesión 1 · WOKI en Raspberry Pi + TS7 Pro

Fecha: 21-11-2026. Carpeta de trabajo: `/Users/emmypardo/Documents/Repositorios/woki-ux-research/raspberry/`

## Cómo retomar
En la terminal nueva:
1. Lee `BRIEF-RASPBERRY.md` completo. Ahí están las reglas, las restricciones y los entregables.
2. Lee `00-TS7-PRO-VERIFICADO-Y-PLAN.md`: las especificaciones verificadas, con fuentes, y el plan.
3. Sigue en el punto **"Pendiente de la usuaria"** (más abajo).

## Hecho en esta sesión
- Leí el brief completo.
- Verifiqué las especificaciones de la TS7 Pro en la documentación oficial de SunFounder y en el PDF de montaje oficial (`a0000769-ts7-pro.pdf`, en GitHub, sunfounder/sf-pdf).
- Creé `00-TS7-PRO-VERIFICADO-Y-PLAN.md`, que tiene la tabla de especificaciones, cómo va montada la Pi, los riesgos con la Pi 5, los cálculos de ángulo visual, el plan en 6 entregables y las fuentes.
- Todavía **no** escribí código, scripts ni la lista de materiales. No se compró ni se flasheó nada.

## Datos clave verificados (fuente oficial)
- 7" IPS de **1024×600 a 60 Hz**, 300 cd/m², 170°. El área visible mide 154,21 × 85,92 mm.
- **Video solo por HDMI** (no es DSI). La entrada acepta de 640×480 a 1920×1200 y lo reescala.
- **Táctil capacitivo de 5 puntos por USB**. Dos parlantes de 8 Ω/2 W; el audio llega por HDMI.
- La pantalla funciona a 5 V y consume 3,5 W. La Pi va **boca abajo** en el zócalo hembra de 40 pines de la pantalla, y esta toma la corriente de la Pi. La corriente entra por el USB-C de la Pi. Los 40 pines quedan libres para sensores.
- La caja trae **puentes rígidos de HDMI y USB, solo en versión Pi 3 y Pi 4**. También trae un cable HDMI, un cable micro-HDMI y cables micro-USB, que sirven de respaldo.
- La carcasa acrílica tiene agujeros para colgarla en la pared, para la cámara CSI, para el PiPower y para un disco de 2,5". **VESA: no consta. Ventilador: no consta.**
- Medidas: 165 × 114 × 40 mm, más 55 mm del soporte metálico. Precio: US$ 89,99.

## Riesgos abiertos
- **La compatibilidad con la Pi 5 NO está confirmada.** La tienda la anuncia "para Pi 4B/3B+/3B/Zero 2W".
- Lo siguiente es inferencia, sin verificar:
  - el puente USB "Pi 4" podría no calzar en la Pi 5, porque los USB y el Ethernet están invertidos;
  - el Active Cooler podría no caber con la Pi boca abajo;
  - hay que comprobar que los 5 V / 5 A de la Pi 5 alcancen.
- La cámara CSI de la Pi 5 necesita un cable de 22 pines. Con la webcam USB este problema desaparece.
- El FAQ dice "elige 1280x800", lo que contradice la ficha técnica (1024×600). Usamos 1024×600 y lo confirmaremos con `wlr-randr`.

## Números para la sesión de diseño
- El lienzo de 1920×1080 se reduce a 1024×600 con un factor de **0,533**, y sobran 24 px de franja vertical. Un texto de 32 px queda en unos 17 px.
- Ángulo visual de la pantalla entera:
  - 50 cm: 17,5° × 9,8°
  - 60 cm: 14,6° × 8,2°
  - 70 cm: 12,6° × 7,0°
- Si se apunta con la mirada, las zonas tienen que ser **pocas y grandes**. El número exacto sale de cruzar estos ángulos con el error medido en `../reports/Calibración eye tracking por webcam.md`, que todavía no he leído.

## Pendiente de la usuaria (bloquea el entregable #0)
1. ¿Ya tiene la TS7 Pro físicamente? Si la tiene, puede probar si el puente USB "Pi 4" calza en una Pi 5.
2. ¿Qué placa usamos? Mi recomendación es la **Pi 5 de 8 GB**, con los cables sueltos como respaldo. La alternativa es una Pi 4, con la que el montaje está garantizado pero rinde menos.

## Próximos pasos (en orden)
| # | Entregable | Archivo | Estado |
|---|---|---|---|
| 0 | Decidir la placa | — | esperando a la usuaria |
| 3 | Servicios systemd + `woki-sensores` (bleak, gpiozero, luma.oled, WebSocket en :8765, watchdog de la alarma y "SIN CONEXIÓN") | `03-SERVICIOS.md`, `woki-sensores/` | se puede empezar ya |
| 6 | Adaptación a 7" (zonas y escala) | `06-PANTALLA-7.md` | se puede empezar ya |
| 1 | Lista de materiales con links y precios | `01-BOM.md` | después de #0 |
| 2 | Instalación: Bookworm, labwc, kiosko de Chromium, rotación, táctil, sin salvapantallas | `02-INSTALACION.md`, `scripts/` | después de #0 |
| 4 | Montaje físico: brazo, 50–70 cm, cámara, BLE, ventilación | `04-MONTAJE.md` | después de #0 |
| 5 | Prueba de fps de MediaPipe en Chromium y plan B | `05-RENDIMIENTO.md`, `bench/` | necesita el aparato armado |

## Reglas que hay que mantener (del brief)
- Escribir en español y entregar todo en archivos locales dentro de `raspberry/`.
- No rediseñar la interfaz, el eye tracking ni el seguimiento de la nariz: eso es de otra sesión. Aquí solo se integra.
- Los sensores sobre el cuerpo son **solo inalámbricos** (BLE). Antes de cualquier montaje con cable, citar la guía AT-04-001 de Advancer y el FAQ de MyoWare.
- La alarma tiene que sobrevivir a un corte de luz, a que la app se cuelgue y a que se caiga la red (heartbeat, watchdog y UPS).
- La Pi tiene que funcionar sin internet.
- No sugerir Vercel, Railway ni Supabase.
- Los subagentes corren en Sonnet.
- Confirmar con la usuaria antes de comprar o de hacer algo irreversible.
