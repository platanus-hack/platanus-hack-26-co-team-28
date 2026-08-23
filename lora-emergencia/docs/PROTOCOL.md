# PROTOCOL · Mensajes y parámetros LoRa

> **Documento legacy.** Conserva el primer protocolo de cuatro campos para explicar la
> evolución y reproducir pruebas antiguas. El protocolo vigente del command center está en
> [`PROTOCOLO-MINIMO.md`](PROTOCOLO-MINIMO.md). No mezcles ambos formatos en un demo.

## Parámetros de radio (críticos)

Todas las placas deben usar EXACTAMENTE los mismos valores:

```cpp
radio.begin(915.0, 125.0, 7, 5, 0x12, 20, 8);
```

| Parámetro | Valor | Nota |
|---|---|---|
| Frecuencia | 915.0 MHz | Banda libre en Colombia (915-928 MHz). No uses < 915 |
| Ancho de banda (BW) | 125 kHz | |
| Spreading Factor (SF) | 7 | Bajo = rápido, corto alcance. Sube a 9-10 para más rango |
| Coding Rate (CR) | 5 | (4/5) |
| Sync word | 0x12 | Red privada. 0x34 es LoRaWAN público, no lo uses |
| Potencia | 20 dBm | Máximo del SX1276 |
| Preámbulo | 8 símbolos | |

**La falla nº1 de LoRa:** si un solo parámetro difiere entre dos placas, no se oyen y **no hay error visible**. Si no recibes nada, revisa esto antes que nada.

## Formato del reporte (nodo → gateway)

Texto plano, campos separados por `|`:

```
a3f21c|atrapado|apto401|604232
 nodeID  estado   detalle  timestamp(ms)
```

- ~30-40 bytes. LoRa punto a punto admite ~240 bytes, cabe de sobra.
- El `nodeID` identifica la placa. Hoy está fijo (`a3f21c`); lo ideal es derivarlo de la MAC.

## Salida del gateway (por serial, para la Pi)

```
RECV|a3f21c|atrapado|apto401|604232|RSSI:-23.00|SNR:9.50
```

- `RSSI` = fuerza de señal en dBm (más cerca de 0 = más fuerte).
- `SNR` = relación señal/ruido en dB.
- El script `scripts/pi_reader.py` parsea estas líneas.

## ACK (bidireccional)

En los firmwares `_bidir`:

- El nodo envía el reporte y pasa a escuchar.
- El gateway recibe, imprime, espera 20 ms, y envía de vuelta: `ACK|a3f21c`.
- El nodo espera el ACK hasta 1.5 s. Si no llega, reintenta hasta 3 veces con backoff aleatorio (100-500 ms).
- El "gracias" real es el ACK por LoRa, no el POST del WiFi. Esto evita el falso positivo de creer que un reporte llegó cuando se perdió.

## Límite a recordar

LoRa es half-duplex: una placa transmite o escucha, no las dos a la vez. Con muchos mensajes simultáneos hay colisiones. Mitigaciones en `docs/ARCHITECTURE.md`.

## Reglas para el payload

- Solo datos cortos y estructurados: códigos, números, coordenadas, frases muy cortas.
- Nunca texto libre largo, fotos, audio ni video. Eso se queda en el WiFi local.
