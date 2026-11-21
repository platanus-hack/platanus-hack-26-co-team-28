# Brief · WOKI en Raspberry Pi con la pantalla SunFounder TS7 Pro (7" táctil)

Esta sesión se dedica **solo al sistema operativo y al montaje sobre Raspberry Pi**. El diseño de la interfaz, el eye tracking y el seguimiento de la nariz siguen en otra sesión: no los rediseñes aquí, intégralos.

## Qué es WOKI
Es un comunicador manos libres para personas con ELA (usuaria de diseño: "Marta", ELA media, mueve ojos y cabeza). Equipo finalista de Platanus Hack 26 (Santiago, 20–22 de noviembre de 2026). La demo de la hackathon se hace con un Mac. **Esta sesión diseña el aparato dedicado para después de la hackathon.**

## Lo que ya existe (no lo rehagas)
- **Prototipo web:** `/Users/emmypardo/Documents/Repositorios/woki-ux-research/prototipo/woki-os.html`. Es un solo archivo HTML.
  - Interfaz tipo sistema operativo para TV (lienzo de 1920×1080 que se escala).
  - Puntero con la nariz usando MediaPipe tasks-vision 0.10.14 (por ahora desde CDN), con calibración inicial.
  - Clic con la cara o por EMG, voz con Web Speech, alarma, y LCD y LEDs simulados.
- **Protocolo WebSocket que el prototipo ya escucha:** `ws://localhost:8765`
  - Clic EMG: `{"src":"ceja"|"mandibula","edge":"down"|"up"}`
  - Mirada externa (opcional): `{"gaze":{"x":<px>,"y":<px>}}`
- **Investigación y diseño:**
  - `../GUIA-DISENO.md`
  - `../PLAN.md`
  - `../PLAN-ONBOARDING-MEMORIA.md`
  - `../reports/Calibración eye tracking por webcam.md` (clave: a 2–2,5 m el iris casi no se ve en una webcam; a 50–70 cm sí)

## Hardware
- **Pantalla: SunFounder TS7 Pro, 7" táctil.** Verifica en la fuente oficial resolución, conexión (HDMI, DSI o USB táctil), alimentación, compatibilidad con Pi 5 y soporte de montaje. No asumas especificaciones.
- **Placa:** se propone Raspberry Pi 5 de 8 GB (confirmar).
- **Sensores:** 3 MyoWare 2.0 con Wireless Shield (ESP32, BLE, batería de 40 mAh). Firmware de ejemplo `MyoWareBLEPeripheral`.
- **Kit Arduino disponible, que podría pasar a los GPIO de la Pi:** LCD 16×2 I2C, LEDs, relé de 5 V, servo SG90, RFID RC522 con llavero, sensor de sonido, DHT11, HC-SR04, matriz LED 8×8. También una OLED de 0,96" (I2C, SSD1306).
- **Disponibles además:** webcam USB, iPhone, AirPods Pro 2 y Mac M4 Pro.

## Arquitectura propuesta (punto de partida, a validar)
```
Pi 5 ── HDMI/DSI ──▶ TS7 Pro (pantalla principal, en la cama a 50–70 cm)
   │                  └ opcional: TV por HDMI 2 como pantalla para la familia
   ├─ Chromium en modo kiosko → WOKI OS servido localmente (sin internet)
   ├─ woki-sensores (Python, systemd): bleak (EMG BLE) + gpiozero (LEDs, relé, servo) + mfrc522 (RFID) + luma.oled → WebSocket :8765
   ├─ woki-voz: Piper TTS sin internet (voz en español) · ElevenLabs con internet
   ├─ webcam USB (si MediaPipe en Chromium no alcanza ~15 fps → visión nativa en Python o AI HAT+ Hailo, y mandar el punto por WebSocket)
   └─ UPS HAT con batería (la alarma debe funcionar si se corta la luz)
```

## Restricciones no negociables
- **Seguridad eléctrica:** la Pi va enchufada a la red. **Los sensores sobre el cuerpo son SOLO inalámbricos** (MyoWare por BLE). Nunca se conecta un sensor con electrodos por cable a los GPIO sin un aislador. Antes de cualquier montaje con cable, cita la guía AT-04-001 de Advancer y el FAQ de MyoWare.
- **La alarma de emergencia** tiene que sobrevivir a un corte de luz, a que la app se cuelgue y a que se caiga la red. Usar heartbeat y watchdog, y que la OLED/LED muestre "SIN CONEXIÓN".
- **Sin internet:** la Pi tiene que funcionar sin red (modelos de MediaPipe locales, Piper, frases guardadas). Claude y ElevenLabs se usan solo cuando hay conexión.
- **Política de la organización:** no sugerir Vercel, Railway ni Supabase.
- No es un dispositivo médico certificado. Es un prototipo.

## Qué entregar en esta sesión
1. **Lista de materiales** con links y precios (Pi 5, fuente, refrigeración, UPS, SSD o SD, webcam, brazo o soporte para la cama, gabinete compatible con la TS7 Pro).
2. **Guía de instalación paso a paso:** Raspberry Pi OS Bookworm, pantalla y táctil de la TS7 Pro, kiosko de Chromium (Wayland/labwc), sin protector de pantalla, rotación, arranque directo a WOKI.
3. **Servicios systemd** y el esqueleto del servicio de sensores en Python que hable el protocolo WebSocket de arriba.
4. **Montaje físico:** dónde va la pantalla, la cámara (cerca de la cara para que el eye tracking funcione) y los sensores. Brazo articulado para la cama o la silla, cables y ventilación.
5. **Prueba de rendimiento:** cómo medir los fps de MediaPipe en Chromium sobre una Pi 5, y el plan B si no alcanza.
6. **Adaptación a pantalla de 7"** (coordinarla con la sesión de diseño): cuántas zonas caben a 50–70 cm y qué cambia del lienzo de 1920×1080.

## Cómo trabajar con la usuaria
- Escribe en español y da respuestas prácticas y verificables.
- Entrega todo en archivos locales, en esta carpeta (`raspberry/`).
- Los subagentes corren en Sonnet, salvo que se pida otra cosa.
- Antes de comprar o de hacer algo irreversible, confirma.
