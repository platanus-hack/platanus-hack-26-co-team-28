# Toolchain y técnicas de desarrollo

Guía reproducible para preparar una Mac o Raspberry Pi, compilar los firmwares y verificar el command center. Compilar no modifica ninguna placa; `--upload` sí escribe firmware en el dispositivo seleccionado.

## 1. Instalar Arduino CLI

macOS:

```bash
brew install arduino-cli
```

Comprueba la instalación:

```bash
arduino-cli version
```

## 2. Configurar el core ESP32

```bash
arduino-cli config init
arduino-cli config add board_manager.additional_urls https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
arduino-cli core update-index
arduino-cli core install esp32:esp32
```

El core es una descarga grande. Solo se instala una vez por máquina.

## 3. Instalar RadioLib

```bash
arduino-cli lib install RadioLib
arduino-cli lib list
```

## 4. Identificar las placas

Conecta las TTGO con antena 915 MHz y cable USB de datos:

```bash
arduino-cli board list
```

Puertos habituales:

- macOS: `/dev/cu.usbserial-...`
- Raspberry Pi/Linux: `/dev/ttyUSB0`

Nunca energices o transmitas con una placa sin antena.

## 5. Compilar sin flashear

Desde `lora-emergencia/`:

```bash
arduino-cli compile --fqbn esp32:esp32:ttgo-lora32 gateway_bidir
arduino-cli compile --fqbn esp32:esp32:ttgo-lora32 nodo_recurso
```

Esta es la verificación mínima después de cambiar firmware.

## 6. Compilar y flashear

```bash
./scripts/flash.sh gateway_bidir /dev/cu.usbserial-GATEWAY
./scripts/flash.sh nodo_recurso /dev/cu.usbserial-RECURSO
```

El script fija `UploadSpeed=115200`, que es más estable que 921600 en estas placas.

## 7. Monitor serial

```bash
./scripts/monitor.sh /dev/cu.usbserial-GATEWAY
```

Baud del proyecto: `115200`.

## 8. Command center

```bash
cd center
python3 -m unittest -v
python3 center.py --demo
```

Con hardware:

```bash
pip install -r requirements.txt
python3 center.py /dev/cu.usbserial-GATEWAY --db center.db
```

Abre `http://localhost:8080`. En Raspberry Pi, otros equipos de la misma red local pueden usar `http://<ip-de-la-pi>:8080`.

## Técnicas de firmware aplicadas

### Recepción no bloqueante

El gateway y el nodo recurso usan:

1. `setPacketReceivedAction()` para registrar una interrupción mínima.
2. `startReceive()` para mantener el SX1276 escuchando.
3. Una bandera `volatile` que el `loop()` consume fuera de la interrupción.
4. `readData()` únicamente desde el `loop()`, nunca desde la ISR.

Esto permite atender radio, USB serial y servidor web sin quedar detenido dentro de `receive()`.

### Cambio seguro RX → TX → RX

Antes de transmitir:

1. Se deshabilita la bandera de recepción.
2. Se limpia la acción de interrupción.
3. La radio pasa a `standby()`.
4. Se ejecuta CAD y se transmite.
5. Se restaura la interrupción y `startReceive()`.

La secuencia evita interpretar el fin de una transmisión propia como un paquete recibido.

### CAD

`scanChannel()` comprueba si el canal parece libre antes de transmitir. Reduce colisiones, pero no garantiza entrega; por eso siguen siendo necesarios ACK, timeout, reintentos e idempotencia.

### Serial estructurado

La Raspberry y el gateway intercambian líneas terminadas en `\n`:

```text
TX|<frame>
RX|<frame>|RSSI:x|SNR:y
ACK|origin|destination|message_id|RSSI:x|SNR:y
TX_SENT|origin|destination|type|message_id
TX_ERROR|message_id|code
```

Los logs humanos usan otros prefijos y no forman parte del contrato.

### Verificación proporcional

- Python: `compileall`, pruebas unitarias y arranque HTTP en modo demo.
- Firmware: compilación de cada sketch con el FQBN real.
- Hardware: prueba end-to-end con dos placas; la compilación no demuestra RF, ACK ni coexistencia WiFi/LoRa.

## Problemas frecuentes

- `arduino-cli: command not found`: instala la CLI y abre una terminal nueva.
- `platform not installed`: ejecuta `arduino-cli core install esp32:esp32`.
- `RadioLib.h: No such file`: ejecuta `arduino-cli lib install RadioLib`.
- Puerto ausente: cambia el cable o revisa el driver USB-serial.
- Upload inestable: usa el script con velocidad 115200.
- Compila pero no comunica: comprueba todos los parámetros LoRa en ambos sketches.
