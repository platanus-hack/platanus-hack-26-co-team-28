# ARCHITECTURE · Diseño del sistema

## La idea en una frase

El WiFi es el último metro hacia el celular. LoRa es el puente de kilómetros entre nodos. El valor está en la distancia: un centro ve reportes de km de zona sin celular ni internet.

## Cadena completa

```
📱 celular
   │ WiFi 2.4 GHz (red abierta "AYUDA")
NODO (TTGO)  WiFi AP + portal cautivo + LoRa TX/RX
   │ LoRa 915 MHz (1-3 km, sin cable)
GATEWAY (TTGO)  LoRa RX/TX
   │ USB serial
RASPBERRY PI  mapa + parser + estado
   │ WiFi hotspot
Pixel / Starlink → 🌐 internet (opcional, intermitente)
```

- **WiFi** = celular ↔ nodo (metros).
- **LoRa** = nodo ↔ gateway (kilómetros).
- El celular nunca toca LoRa. Ningún celular tiene radio LoRa.

## Arquitectura de dos niveles (para muchos usuarios)

El cuello de botella no es la cantidad de personas. Es la cantidad de transmisiones LoRa por segundo.

- **Nivel 1 (borde):** cada nodo agrupa a sus usuarios por WiFi. Los mensajes viven en WiFi local. El nodo calcula un resumen y manda 1 paquete LoRa cada 30-60 s. Esto absorbe ~98% de la carga.
- **Nivel 2 (backhaul):** 5-10 nodos hablan al centro por LoRa con mensajes cortos.

Cálculo: 10 nodos, 1 resumen/60 s en SF8 (~0.15 s de aire) ocupan el canal ~2.5% del tiempo. Margen enorme.

## Mitigación de colisiones y pérdida (prioridad)

| Técnica | Qué resuelve | Cabe en el hardware |
|---|---|---|
| Agregación en el borde | El volumen de usuarios (98% de la carga) | ✅ Es lo primero |
| SF bajo (SF7/SF8) | Tiempo en el aire por mensaje | ✅ Solo config |
| ACK + reintento con backoff aleatorio | Paquetes perdidos | ✅ Ya está en `_bidir` |
| CAD / listen-before-talk (RadioLib `scanChannel()`) | Colisiones | ✅ Capa extra, no garantía |
| MeshCore (backhaul enrutado) | Chatter de la malla | ✅ Mismo hardware |

Límites duros del SX1276 (no se pueden superar con este chip):
- Oye 1 frecuencia y 1 SF a la vez. Para multi-canal se necesita un concentrador SX1302.
- No soporta LR-FHSS (solo chips SX126x).

## Roadmap

- [x] Enlace LoRa una vía (nodo_tx + gateway_rx)
- [x] Enlace bidireccional con ACK (nodo_bidir + gateway_bidir)
- [x] Portal cautivo en el nodo (WiFi `AYUDA` + formulario, `nodo_portal`)
- [x] Dashboard del centro que lee el gateway (`center/center.py`)
- [ ] Probar el portal cautivo en teléfonos reales (iOS / Android)
- [ ] Mapa geográfico (hoy es tablero por nodo, sin GPS)
- [ ] Agregación en el borde (resumen por nodo)
- [ ] CAD antes de transmitir
- [ ] nodeID derivado de la MAC
- [ ] Múltiples nodos separados por distancia (el valor real)

## Firmware recomendado para el nodo

Para el portal cautivo, considera partir del fork vivo `jerkey/disaster-radio` (ESP32 + LoRa + portal cautivo ya funcionando en TTGO). Evita escribir el portal desde cero.
