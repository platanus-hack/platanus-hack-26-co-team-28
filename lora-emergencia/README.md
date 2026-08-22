# lora-emergencia

Red de nodos de emergencia. Comunicación entre placas **LilyGO TTGO LoRa32** por LoRa 915 MHz, para llevar reportes cortos desde una zona sin señal hasta un centro de operaciones.

Este repo tiene el firmware que ya funciona entre dos placas, los scripts para flashear y leer, y la documentación para seguir avanzando.

---

## Estado actual (qué ya funciona)

- ✅ Enlace LoRa de una vía entre 2 placas. Verificado en hardware.
- ✅ Enlace bidireccional con ACK. El gateway confirma cada reporte.
- ✅ Toolchain macOS con `arduino-cli` + RadioLib.

Pruebas reales medidas entre 2 placas a ~20 cm:

Una vía (gateway recibe el reporte):
```
RECV|a3f21c|atrapado|apto401|604232|RSSI:-23.00|SNR:9.50
```

Bidireccional (el nodo recibe el ACK de vuelta):
```
[NODO] ACK recibido. RSSI:-21.00 SNR:9.25
```

La cadena completa: nodo → LoRa 915 → gateway → ACK → nodo. Con pérdidas ocasionales que dispara el reintento, comportamiento normal de LoRa sin CAD.

---

## Hardware

- 2× **LilyGO TTGO LoRa32**, modelo **T3 V1.6.1**, banda **915 MHz** (chip **SX1276**).
- La placa integra ESP32 (WiFi + BT) + radio LoRa SX1276 + conector SMA + batería JST + micro-USB.
- Antena 915 MHz (viene en la caja o se compra aparte).
- Cable **micro-USB de datos** (no de solo carga).

**Regla de oro:** nunca energizar una placa sin la antena enroscada. Transmitir sin antena daña el amplificador de forma permanente.

Ver [`docs/HARDWARE.md`](docs/HARDWARE.md) para pines y detalles.

---

## Estructura del repo

```
lora-emergencia/
├── README.md                 este archivo
├── nodo_tx/                  firmware: solo transmisor (test más simple)
├── gateway_rx/               firmware: solo receptor (test más simple)
├── nodo_bidir/               firmware: nodo con ACK (bidireccional)
├── gateway_bidir/            firmware: gateway con ACK (bidireccional)
├── nodo_portal/              firmware MVP: WiFi "AYUDA" + portal cautivo + LoRa
├── nodo_recurso/             firmware: recurso que recibe despachos/broadcasts + web local
├── center/
│   ├── center.py             command center offline del puesto de mando
│   ├── command_core.py       dominio, protocolo y persistencia SQLite
│   ├── CENTRO.md             guía operativa Raspberry ↔ gateway ↔ recursos
│   └── TOOLCHAIN.md          instalación, compilación y diagnóstico
├── scripts/
│   ├── flash.sh              compilar y subir un firmware a una placa
│   ├── monitor.sh            leer el serial de una placa
│   └── pi_reader.py          leer y parsear el gateway desde la Raspberry Pi
└── docs/
    ├── SETUP.md              instalar el entorno paso a paso
    ├── HARDWARE.md           placa, pines, antena
    ├── PROTOCOL.md           formato de mensajes y parámetros LoRa
    ├── ARCHITECTURE.md       diseño del sistema y roadmap
    └── TROUBLESHOOTING.md    errores reales y cómo se resolvieron
```

---

## Quickstart

### 1. Instala el entorno (una sola vez)

```bash
brew install arduino-cli
arduino-cli config init
arduino-cli config add board_manager.additional_urls https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
arduino-cli core update-index
arduino-cli core install esp32:esp32     # descarga grande (~500 MB), tarda
arduino-cli lib install RadioLib
```

Detalle completo en [`docs/SETUP.md`](docs/SETUP.md).

### 2. Encuentra el puerto de tu placa

Conecta la placa (con antena) y corre:

```bash
arduino-cli board list
```

Busca algo como `/dev/cu.usbserial-XXXXXXXX` (macOS) o `/dev/ttyUSB0` (Linux/Pi).

### 3. Flashea y prueba el enlace de una vía

Con dos placas y dos puertos:

```bash
# Placa 1 = transmisor
./scripts/flash.sh nodo_tx /dev/cu.usbserial-AAAA

# Placa 2 = receptor
./scripts/flash.sh gateway_rx /dev/cu.usbserial-BBBB

# Lee el receptor: deben aparecer las lineas RECV|...
./scripts/monitor.sh /dev/cu.usbserial-BBBB
```

### 4. Prueba el enlace bidireccional con ACK

```bash
./scripts/flash.sh gateway_bidir /dev/cu.usbserial-BBBB
./scripts/flash.sh nodo_bidir    /dev/cu.usbserial-AAAA
./scripts/monitor.sh /dev/cu.usbserial-AAAA   # el nodo muestra "ACK recibido"
```

---

## Los 4 firmwares

| Firmware | Rol | Qué hace |
|---|---|---|
| `nodo_tx` | Transmisor | Envía un reporte cada 5 s. El test más simple |
| `gateway_rx` | Receptor | Recibe y lo imprime con RSSI y SNR |
| `nodo_bidir` | Nodo con ACK | Envía, espera confirmación, reintenta 3 veces con backoff |
| `gateway_bidir` | Gateway con ACK | Recibe, imprime, y confirma de vuelta al nodo |

Empieza siempre por `nodo_tx` + `gateway_rx`. Si el enlace de una vía funciona, todo lo demás es software.

---

## MVP de emergencia (ciclo completo)

El flujo mínimo: un civil pide ayuda desde su celular, sin app, y el reporte llega al puesto de mando.

```
📱 civil → WiFi "AYUDA" → NODO (portal) → LoRa → GATEWAY → USB → CENTRO (dashboard)
```

Componentes:
- **Nodo** (`nodo_portal`): red WiFi abierta `AYUDA` + portal cautivo (sin app, sin JS). Botones: agua, médico, rescate, a salvo + detalle. Envía por LoRa y espera ACK.
- **Gateway** (`gateway_bidir`): recibe el reporte, responde ACK, lo imprime por serial.
- **Centro** (`center/center.py`): lee el gateway y muestra un tablero en vivo con contadores y color por tipo.

### Cómo correrlo

```bash
# 1. Placa del nodo (crea la red AYUDA)
./scripts/flash.sh nodo_portal /dev/cu.usbserial-AAAA

# 2. Placa del gateway (conectada a la Mac o a la Pi)
./scripts/flash.sh gateway_bidir /dev/cu.usbserial-BBBB

# 3. Centro: lee el gateway y abre el tablero
pip install pyserial          # o: pip install pyserial --break-system-packages
python3 center/center.py /dev/cu.usbserial-BBBB
# abre http://localhost:8080

# 4. Con el celular: conéctate a la red WiFi "AYUDA".
#    El portal se abre solo. Pide ayuda. El reporte aparece en el tablero.
```

Modo sin hardware para probar el tablero:
```bash
python3 center/center.py --demo
```

### Estado verificado

- Nodo: `SoftAP 'AYUDA' en 192.168.4.1` + `LoRa OK`. ✅
- Gateway: recibe + ACK. ✅
- Centro: tablero + API de reportes. ✅
- Falta probar en un teléfono real el disparo del portal cautivo (iOS lo abre solo; Android a veces pide abrir el navegador en `192.168.4.1`).

---

## Parámetros LoRa (deben coincidir en TODAS las placas)

```cpp
radio.begin(915.0, 125.0, 7, 5, 0x12, 20, 8);
//          freq   BW    SF CR sync pwr preamble
```

**La falla nº1 de LoRa:** si un solo parámetro difiere entre dos placas, no se oyen y **no hay ningún mensaje de error**. Si no recibes nada, revisa esto primero.

Ver [`docs/PROTOCOL.md`](docs/PROTOCOL.md).

---

## Próximos pasos (para el equipo)

1. **Portal cautivo en el nodo:** WiFi abierto `AYUDA` + formulario HTML que genera el reporte.
2. **Lector en la Raspberry Pi:** `scripts/pi_reader.py` ya parsea los `RECV|...`. Falta conectarlo a un mapa.
3. **Agregación en el borde:** que el nodo junte varios reportes de WiFi y mande un resumen por LoRa (baja la carga ~98%).
4. **CAD / listen-before-talk:** reduce colisiones cuando varios nodos transmiten.

Ver el diseño completo y el roadmap en [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Si algo no funciona

Lee [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md). Los errores reales que ya resolvimos:
- Subida falla a 921600 → usa `UploadSpeed=115200` (los scripts ya lo hacen).
- El puerto no aparece → driver USB o cable de solo carga.
- No recibe nada → los 6 parámetros LoRa no coinciden.
