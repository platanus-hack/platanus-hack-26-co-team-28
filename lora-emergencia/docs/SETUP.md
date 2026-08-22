# SETUP · Entorno de desarrollo

Probado en macOS (Apple Silicon, Tahoe). En Linux/Raspberry Pi los pasos son iguales, cambia solo la instalación de `arduino-cli`.

## 1. Instalar arduino-cli

macOS:
```bash
brew install arduino-cli
```

Linux / Raspberry Pi:
```bash
curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | sh
```

## 2. Configurar el core ESP32

```bash
arduino-cli config init
arduino-cli config add board_manager.additional_urls https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
arduino-cli core update-index
arduino-cli core install esp32:esp32
```

La última línea descarga ~500 MB y descomprime toolchains grandes. Puede tardar varios minutos. Hazlo con buena conexión y una sola vez.

## 3. Instalar la librería de radio

```bash
arduino-cli lib install RadioLib
```

Versión probada: RadioLib 7.7.1.

## 4. Driver USB

En macOS moderno, la placa se reconoce **sin instalar driver**. Aparece como `/dev/cu.usbserial-XXXXXXXX`.

Si NO aparece:
- Chip **CP2102** → driver Silicon Labs CP210x VCP.
- Chip **CH9102 / CH340** → driver WCH CH34x.
- Instala, reinicia, y vuelve a conectar.

## 5. Verificar

```bash
arduino-cli board list
```

Debe listar tu placa con un puerto USB.

## FQBN de la placa

La placa se identifica en arduino-cli como:

```
esp32:esp32:ttgo-lora32
```

Para subir a velocidad estable (importante, ver TROUBLESHOOTING):

```
esp32:esp32:ttgo-lora32:UploadSpeed=115200
```

## Notas

- La **primera** compilación de un sketch ESP32 es lenta (arma todo el core). Las siguientes son rápidas.
- Si la subida falla justo al conectar, mantén presionado el botón **BOOT** de la placa mientras sube.
