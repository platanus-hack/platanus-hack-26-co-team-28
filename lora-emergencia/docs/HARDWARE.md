# HARDWARE · LilyGO TTGO LoRa32 T3 V1.6.1

## La placa

- Modelo: **LilyGO TTGO LoRa32**, silkscreen **T3_V1.6.1**.
- SoC: **ESP32-PICO-D4** (WiFi 2.4 GHz + Bluetooth + doble núcleo).
- Radio LoRa: **Semtech SX1276**, banda **915 MHz** (también existe versión 868).
- Conector de antena: **SMA** (dorado).
- Alimentación: micro-USB, o batería LiPo por conector JST 1.25.
- Controles: interruptor ON/OFF, botón RST, botón BOOT.
- Chip USB-serial: CP2102 o CH9102 según el lote (macOS moderno los reconoce solos).

## Pines LoRa (SX1276) para RadioLib

Estos son los pines usados en todos los firmwares del repo:

| Función | GPIO |
|---|---|
| SCK  | 5  |
| MISO | 19 |
| MOSI | 27 |
| CS / NSS | 18 |
| RST  | 23 |
| DIO0 | 26 |
| DIO1 | 33 |

En código:

```cpp
#include <RadioLib.h>
SPI.begin(5, 19, 27, 18);                    // SCK, MISO, MOSI, CS
SX1276 radio = new Module(18, 26, 23, 33);   // CS, DIO0, RST, DIO1
```

## Antena

- Enrosca la antena 915 MHz en el conector SMA **antes** de energizar.
- **Nunca transmitas sin antena.** El SX1276 se daña de forma permanente.
- Una antena látigo de 915 MHz mide ~7-8 cm. Una de ~17 cm suele ser de 433 MHz (no sirve).

## Alimentación en campo

- Un nodo activo (WiFi AP + LoRa) consume ~120-250 mA.
- Un powerbank de 20.000 mAh lo mantiene más de 24 h.
- Aviso: algunos powerbanks se apagan solos cuando el consumo baja de 50-100 mA. Con el nodo activo no pasa, pero pruébalo con el powerbank real.

## OLED

Algunas T3 V1.6.1 traen pantalla OLED (I2C, SDA 21 / SCL 22) y otras no. Los firmwares vigentes `gateway_bidir`, `nodo_portal_https` y `range_movil` la detectan antes de usarla; la operación principal no depende de que esté presente.
