# Red de emergencia sin internet (LoRa 915 MHz)

Cuando un terremoto tumba la red celular, la gente atrapada no puede pedir ayuda y el puesto de mando no sabe a dónde ir. Nuestro sistema lleva reportes cortos desde una zona sin señal hasta un centro de operaciones usando radios **LoRa 915 MHz**, sin depender de internet ni de celular.

## Cómo funciona

```
📱 civil → WiFi "AYUDA" → NODO (portal cautivo) → LoRa 915 → GATEWAY → USB → CENTRO (tablero)
```

- El **civil** no instala ninguna app. Se conecta a la red WiFi abierta `AYUDA` que emite el nodo. Se abre un portal cautivo con botones: agua, médico, rescate, a salvo.
- El **nodo** codifica el reporte en un paquete corto y lo manda por LoRa. Espera un ACK y reintenta si se pierde.
- El **gateway** recibe el reporte, confirma con un ACK de vuelta, y lo imprime por USB.
- El **centro** lee el gateway y muestra un tablero en vivo con contadores y color por tipo de emergencia.

## Ubicación exacta por GPS

La placa no trae GPS. El GPS sale del **navegador del celular** con `navigator.geolocation`. Como el navegador exige un contexto seguro, el nodo sirve una página **HTTPS** con un certificado válido de `ayuda.homiapp.xyz`. Así el celular pide permiso de ubicación y manda la latitud y longitud reales dentro del reporte.

## Estado verificado en hardware

- ✅ Enlace LoRa de una vía entre 2 placas.
- ✅ Enlace bidireccional con ACK (nodo → LoRa → gateway → ACK → nodo).
- ✅ Portal cautivo `AYUDA` + reporte por botones.
- ✅ Upgrade a GPS exacto por HTTPS.
- ✅ Tablero del centro en vivo.

Prueba real entre 2 placas:

```
A/NODO   : [NODO] TX (intento 1): a3f21c|atrapado|apto401|1
B/GATEWAY: RECV|a3f21c|atrapado|apto401|1|RSSI:-27.00|SNR:9.25
A/NODO   : [NODO] ACK recibido. RSSI:-27.00 SNR:9.25
```

## Hardware

- 2× **LilyGO TTGO LoRa32 T3 V1.6.1**, banda **915 MHz** (chip **SX1276**).
- Antena 915 MHz SMA.
- Toolchain macOS: `arduino-cli` + RadioLib + core ESP32.

## Track

🚨 Emergencies

El código, el firmware y la documentación completa están en la carpeta [`lora-emergencia/`](./lora-emergencia).
