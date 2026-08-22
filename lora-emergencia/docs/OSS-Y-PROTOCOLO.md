# OSS Y PROTOCOLO · Reuso de repos y presupuesto de payload

Documento del arquitecto. Cubre 3 preguntas: que repos OSS reusamos, como mandamos
una ubicacion GPS, y cuanto cabe por LoRa. Alineado al hardware actual: TTGO/ESP32-PICO-D4,
SX1276, RadioLib, `radio.begin(915.0, 125.0, 7, 5, 0x12, 20, 8)`.

---

## 1. Resumen ejecutivo

1. No adoptamos ninguna libreria de mensajeria entera. Copiamos el patron de RadioHead
   `RHReliableDatagram` (header de 4 bytes + reintento + dedup) sobre el RadioLib que ya corre.
2. Del front adoptamos 3 repos reales: `jakesgordon/javascript-state-machine` (FSM del viaje),
   `Leaflet` (mapa), y el patron de `CDFER/Captive-Portal-ESP32` (force-open del portal).
3. La ubicacion GPS viaja como texto decimal en el string `|` actual, con 5 decimales (~1 m).
   No cambiamos a binario, protobuf, geohash ni plus code.
4. Payload maximo por frame: 255 bytes (SX1276 header explicito). Nuestros mensajes miden
   10-52 bytes, o sea usan menos del 21% del maximo.
5. Veredicto de payload: a SF7/BW125 un intercambio SOS+ACK ocupa ~145 ms de aire. Con 3
   nodos y utilizacion del canal al 5%, el presupuesto sano es ~20 intercambios/min totales.

---

## 2. Ranking de repos OSS a reusar

Orden por aplicabilidad (desc) y esfuerzo (asc). Separado por capa.

### (a) Protocolo / mensajeria LoRa

| Repo | Que nos da | Recomendacion | Aplic. | Esfuerzo | Riesgo |
|---|---|---|---|---|---|
| [jgromes/RadioLib](https://github.com/jgromes/RadioLib) | Capa PHY que ya usamos: `transmit()`/`receive()`, CRC HW, `setNodeAddress()`/address filter (1 byte). No trae ACK/retry. | REFERENCIAR | 10 | bajo | Ninguno de compatibilidad. Riesgo: creer que da mensajeria confiable. No la da. |
| [hallard/RadioHead](https://github.com/hallard/RadioHead) (`RHReliableDatagram`) | Datagrama confiable direccionado: header `TO\|FROM\|ID\|FLAGS` (4 B), `sendtoWait()` con reintentos, ACK automatico, dedup por ID. | REFERENCIAR | 9 | medio | Trae su driver `RH_RF95`, obliga a abandonar RadioLib ya verificado. GPL-2.0 contamina el binario. Copiar el patron, ~40 lineas. |
| [LoRaMesher/LoRaMesher](https://github.com/LoRaMesher/LoRaMesher) | Address 16-bit + ACK + multi-hop distance-vector sobre RadioLib + FreeRTOS. | REFERENCIAR | 6 | medio | Sobra para 3 nodos en estrella. Sus tasks FreeRTOS compiten por RAM con `esp_https_server`+SoftAP en el PICO-D4 (520 KB). Plan B si escalan a >3 nodos. |
| [sudomesh/LoRaLayer2](https://github.com/sudomesh/LoRaLayer2) | Capa 2 mesh-first para desastre: framing con MAC 6 B, routing tipo Babel. | REFERENCIAR | 4 | alto | Proyecto PAUSADO. Acoplado al firmware disaster-radio, sin ACK e2e limpio. GPL/AGPL. Solo referencia conceptual. |
| [meshtastic/firmware](https://github.com/meshtastic/firmware) | Protobuf `MeshPacket` (from,to,id,want_ack,hop_limit). | DESCARTAR | 2 | alto | Obliga nanopb + PacketRouter pegado al firmware. GPL-3.0. El equipo ya decidio NO Meshtastic. |
| [sandeepmistry/arduino-LoRa](https://github.com/sandeepmistry/arduino-LoRa) | PHY simple SX1276. | DESCARTAR | 2 | bajo | Alternativa a RadioLib, no capa encima. Cero addressing/ACK/retry. Cambiar seria regresion. |
| [Zensey/TinyMesh](https://github.com/Zensey/TinyMesh) | Mesh minimo para radios seriales. | DESCARTAR | 1 | alto | Inactivo, para modulos Tinymesh seriales, no SX1276 via RadioLib. |

### (b) Encoding GPS / incidente

| Repo | Que nos da | Recomendacion | Aplic. | Esfuerzo | Riesgo |
|---|---|---|---|---|---|
| [meshtastic/protobufs](https://github.com/meshtastic/protobufs/blob/master/meshtastic/mesh.proto) (Position) | La CONVENCION `lat_i = round(lat*1e7)` como `sfixed32`. Precision ~1.1 cm. | REFERENCIAR | 8 | bajo | Adoptar el protobuf entero mata el debug por USB. Tomar solo la formula, no nanopb. |
| [google/open-location-code](https://github.com/google/open-location-code/tree/main/c) | Plus Code en C puro (`OLC_Encode`/`OLC_Decode`), sin dependencias. | REFERENCIAR | 6 | bajo | El demo no necesita direccion global sin internet. El operador ve un mapa, no un codigo. Solo si dictan la ubicacion por voz/radio. |
| [Shib-Sankar-Das/LoRa-GPS-Tracker](https://github.com/Shib-Sankar-Das/LoRa-GPS-Tracker) | Patron minimo de encodear coordenada como string y mandarla. | REFERENCIAR | 6 | bajo | GPS en placa (Neo-6M); nosotros usamos `navigator.geolocation`. Solo aplica el encoding a string. |
| [skeeto/geohash](https://github.com/skeeto/geohash) | Geohash encode/decode en C para embebidos. | DESCARTAR | 4 | bajo | Pesa igual o mas que int32*1e7 (9 B ASCII vs 8 B int) y pierde precision. |
| [nanopb/nanopb](https://github.com/nanopb/nanopb) | Protobuf en C para MCU (<10 kB ROM). Serializa GPS en ~13 B. | DESCARTAR | 3 | medio | Sobreingenieria. Toolchain protoc + `.pb.c` + payload ilegible por USB. Ahorro de 41 a 13 B no importa con 200 B de presupuesto. |
| [yinqiwen/geohash-int](https://github.com/yinqiwen/geohash-int) | Geohash bit-packed int64 (~6-7 B). | DESCARTAR | 3 | medio | int32*1e7 (8 B, 1 cm) es mas simple y mas preciso. |

### (c) Portal + mapa + dispatch UI

| Repo | Que nos da | Recomendacion | Aplic. | Esfuerzo | Riesgo |
|---|---|---|---|---|---|
| [jakesgordon/javascript-state-machine](https://github.com/jakesgordon/javascript-state-machine) | FSM del viaje en 1 archivo, cero deps, MIT. Estados + transiciones + hooks `onEnter`/`onLeave`. Inline en el HTML del operador. | ADOPTAR | 9 | bajo | Ninguno. Liviano, 100% offline en el celular, se sirve desde el ESP32. |
| [Leaflet/Leaflet](https://github.com/Leaflet/Leaflet) | Mapa para operador y centro. `L.marker([lat,lon])`. `leaflet.js` (~42 KB gzip) + css inline. BSD-2. | ADOPTAR | 9 | bajo | Los tiles OSM piden internet. Para demo offline: `L.imageOverlay` con imagen estatica de la zona + marker, o tiles precacheados en SPIFFS. |
| [CDFER/Captive-Portal-ESP32](https://github.com/CDFER/Captive-Portal-ESP32) | Force-open del portal: DNS wildcard + handlers de deteccion por OS (`/generate_204`, `/hotspot-detect.html`, `/connecttest.txt`, `/ncsi.txt`, `/canonical.html`, `/redirect`). ~40 lineas. | ADOPTAR (reimplementar) | 9 | bajo | Licencia Hippocratic HL3 (no OSI). El patron es trivial: reimplementar los 6 handlers, NO copiar el archivo. |
| [esp32async/ESPAsyncWebServer](https://github.com/esp32async/ESPAsyncWebServer/blob/master/examples/CaptivePortal/CaptivePortal.ino) | Ejemplo oficial `CaptiveRequestHandler` + `server.onNotFound()` + DNSServer en puerto 53. LGPL-3.0. | REFERENCIAR | 8 | bajo | Es la libreria que ya usan. Nada nuevo que adoptar salvo confirmar el patron catch-all. |
| [ronith256/ESP32-Portal](https://github.com/ronith256/ESP32-Portal) | El repo mas parecido al demo: nodos ESP32 con webserver + LoRa que reportan a un master que pinta un mapa. | REFERENCIAR | 8 | medio | Sin licencia declarada (no se puede copiar legalmente), codigo inmaduro. Usar como plano de arquitectura, no copiar codigo. |
| [statelyai/xstate](https://github.com/statelyai/xstate) | Statecharts robustos para el lifecycle del viaje. | REFERENCIAR | 5 | medio | Pesado para servir desde SPIFFS. Usar solo como referencia de diseno de estados. |
| [allartk/leaflet.offline](https://github.com/allartk/leaflet.offline) | Tiles raster offline en IndexedDB. | REFERENCIAR | 4 | medio | Depende de localforage y de precachear tiles con internet antes del demo. Overkill si solo se muestra un marker. |

---

## 3. Decision de mensajeria

**Veredicto: seguimos con RadioLib. Copiamos el patron de `RHReliableDatagram`. No migramos a RadioHead.**

Motivo: RadioHead resuelve exacto el "mando y confirmo" (header `TO|FROM|ID|FLAGS`, `sendtoWait()`,
ACK automatico, dedup por ID). Pero trae su propio driver `RH_RF95` y obliga a abandonar RadioLib,
que ya esta verificado con `915/BW125/SF7/CR45/sync0x12/20dBm` y conviviendo con SoftAP+HTTPS.
Ademas RadioHead es GPL-2.0: enlazar su codigo contamina el binario.

Las 3 piezas a copiar sobre RadioLib (~40-60 lineas):

1. **Header de direccionamiento.** Antepones un campo de destino `dst` como 2do token del string
   `|` que ya usan. Filtro por software: si `dst != mi_id` y `dst != broadcast`, la placa ignora el
   frame. Costo: 5-8 bytes, ~5-8 ms de aire. Refuerzo opcional: `setNodeAddress()`/address filter
   del SX1276 (1 byte por hardware).
2. **Loop de reintento.** Transmitir, cambiar a RX, esperar `ACK|<id>` con timeout ~200 ms,
   reintentar hasta 3 veces con backoff aleatorio (100-500 ms). Valores de referencia:
   `setRetries(3)`/`setTimeout(200)` de RadioHead. Esto ya existe en los firmwares `_bidir`.
3. **Idempotencia.** Un array de ultimos IDs `(from,id)` vistos para descartar duplicados por
   reintento.

Esto no toca la PHY ni el portal cautivo. El string `|` viaja igual, solo se le antepone un token
de destino. No hay que rediseñar el formato de mensaje.

Nota sobre el ACK: hoy el ACK es texto `ACK|a3f21c` (10 bytes). Se puede dejar asi por
retro-compatibilidad, o pasar al ACK binario de 4 bytes estilo RadioHead (`TO|FROM|ID|FLAG=0x80`,
sin payload). El binario ahorra 6 bytes y quita el parseo de texto. Para el demo el texto sirve.

---

## 4. Como mandar una ubicacion GPS

Coordenada de prueba: **4.6767, -74.0483** (Bogota). Costo de SOLO la ubicacion en cada formato:

| Formato | Bytes | Precision | Legible USB | Ejemplo |
|---|---|---|---|---|
| Texto decimal 4 dec (ACTUAL) | 15 | ~11 m | si | `4.6767\|-74.0483` |
| Texto decimal 5 dec (RECOMENDADO) | 17 | ~1 m | si | `4.67670\|-74.04830` |
| float32 IEEE-754 LE | 8 | ~7 digitos | no | hex `87a79540bb1894c2` |
| int32*1e7 LE (convencion Meshtastic) | 8 | ~1.1 cm | no | hex `989bc9024820ddd3` (`lat_i=46767000`, `lon_i=-740483000`) |
| Plus Code (10 dig) | 11 | ~13.9 m | si | `67P7MXG2+MM` |
| Geohash (9 char) | 9 | ~2.4 m | si | `d2g6dgrev` |

**Eleccion final: texto decimal con 5 decimales, dentro del string `|` actual.**

Razones concretas:
- La diferencia maxima entre todos los formatos es 9 bytes. Con 200+ bytes de presupuesto es
  irrelevante. El cuello de botella es la fiabilidad del enlace SF7, no los bytes.
- `navigator.geolocation` de un celular da ~5-10 m de exactitud real. Guardar mas de 5 decimales
  (1.1 m) es falsa precision. 4 decimales (11 m) ya iguala al GPS del telefono.
- El texto se lee por USB. La linea `RECV|...` que el gateway imprime sigue humana. Binario/
  protobuf/CBOR rompen ese debug.

Contrato de campos del equipo (fijar como estandar, sin libreria nueva):

```
id | dst | tipo | detalle | lat | lon | severidad
```

- `tipo` = enum cerrado: `atrapado`, `herido`, `incendio`, `fuga`, `rescatado`.
- `lat`/`lon` = decimal, 5 decimales.
- GPS opcional: si el celular no da coordenada, se dejan los campos vacios manteniendo los
  delimitadores. Ejemplo: `op9c2b|CENTRO|acepta|a3f21c||`. El gateway distingue "sin GPS" por
  campo vacio. Nunca bloquea.

Cuando SI valdria binario int32*1e7 (frame de 13 bytes `id[3]+tipo[1]+sev[1]+lat_i[4]+lon_i[4]`):
si cambian a SF10-SF12 (el payload util cae por el airtime) o hacen multi-salto con muchos nodos.
Por ahora, no.

---

## 5. Presupuesto de payload

### Payload maximo

RadioLib con SX1276 en LoRa crudo (header explicito) transmite hasta **255 bytes** por paquete.
Nuestros mensajes reales miden 10-52 bytes. Usamos menos del 21% del maximo. No hay que fragmentar.

### Formula time-on-air (Semtech AN1200.13)

```
Tsym  = 2^SF / BW
Tpre  = (n_pre + 4.25) * Tsym
n_pay = 8 + max( ceil( (8*PL - 4*SF + 28 + 16*CRC - 20*IH) / (4*(SF - 2*DE)) ) * (CR+4), 0 )
TOA   = Tpre + n_pay * Tsym
```

Con SF7, BW=125 kHz, CR=4/5 (CR=1), CRC=1, IH=0, DE=0, preambulo=8:
- `Tsym = 128 / 125000 = 1.024 ms`
- `Tpre = (8 + 4.25) * 1.024 = 12.544 ms`

### Airtime a SF7/BW125

| Payload | n_pay (sim) | Tpay | TOA |
|---|---|---|---|
| 40 bytes | 68 | 69.63 ms | **82.18 ms** |
| 120 bytes | 183 | 187.39 ms | **199.94 ms (~200 ms)** |

Nuestros mensajes de 24-52 bytes caen entre 61 y 103 ms.

### Mensajes/min sanos (3 nodos, estrella hacia el gateway)

- Un intercambio completo = SOS (~103 ms) + ACK (~41 ms) ≈ **145 ms de aire**.
- El canal es uno solo compartido (ALOHA puro, sin CSMA nativo).
- Presupuesto seguro: utilizacion del canal ≤ 5-10%.

| Utilizacion | Aire/min | Intercambios/min totales | Por nodo |
|---|---|---|---|
| 10% | 6000 ms | ~41 | ~13 |
| 5% (recomendado, margen anti-colision) | 3000 ms | **~20** | ~6-7 |

Para eventos a ritmo humano (una solicitud, un despacho, una aceptacion) sobra de lejos.

### Efecto de subir SF (por alcance)

Subir SF multiplica el airtime y mejora la sensibilidad ~2.5 dB por paso.

| Payload | SF7 | SF9 | SF10 |
|---|---|---|---|
| 40 bytes | 82 ms | 288 ms (3.5x) | 535 ms (6.5x) |
| 120 bytes | 200 ms | 636 ms | 1190 ms |
| Sensibilidad | ~-123 dBm | ~-129 dBm | ~-132 dBm |

Margen de enlace actual: RSSI ~-27 dBm y SNR ~9 dB dejan >90 dB sobre el piso de SF7.
Veredicto: dejar SF7 para el demo. Subir a SF9/SF10 solo si el operador esta lejos o con
concreto de por medio, aceptando 3.5x-6.5x mas airtime.

Aviso regulatorio 915 MHz (FCC 15.247, aplicable a la banda libre): con salto de frecuencia el
dwell time por canal es ≤400 ms cada 20 s. Un paquete de 120 B en SF10 (1190 ms) lo supera. En
SF7 todos nuestros paquetes (<103 ms) estan muy por debajo. El demo en SF7 no toca ese limite.

---

## 6. Cadenas literales del demo

El formato extiende el actual con el campo `dst` como 2do token, para direccionar al operador.
Airtime calculado a SF7/BW125/CR4-5/preambulo 8.

| Rol / mensaje | Cadena literal EXACTA | Bytes | Airtime |
|---|---|---|---|
| Solicitud con GPS (civil → centro) | `a3f21c\|CENTRO\|SOS\|atrapado\|apto401\|4.6767\|-74.0483\|1` | 52 | ~102.7 ms |
| Despacho (centro → operador, con destino) | `c1n7r0\|GRUA07\|DISP\|a3f21c\|4.6767\|-74.0483\|1` | 43 | ~87.3 ms |
| Aceptacion sin GPS (operador → centro) | `GRUA07\|CENTRO\|ACC\|a3f21c` | 24 | ~61.7 ms |
| Aceptacion con GPS opcional (operador → centro) | `GRUA07\|CENTRO\|ACC\|a3f21c\|4.7010\|-74.0501` | 40 | ~82.2 ms |
| Cambio de estado (operador → centro) | `GRUA07\|CENTRO\|ST\|a3f21c\|enruta` | 30 | ~71.9 ms |
| ACK (gateway, sin cambios) | `ACK\|a3f21c` | 10 | ~41.2 ms |
| Ping de posicion (operador → centro) | `GRUA07\|CENTRO\|POS\|4.7010\|-74.0501` | 33 | ~71.9 ms |

Estados validos del campo `ST`: `enruta` | `enlugar` | `rescatado` | `cancelado`.
`dst` = `CENTRO` | `GRUA07` | `BROADCAST`. Cada placa filtra por `dst`.

### Conversacion completa end-to-end

```
1. Civil pide ayuda con su GPS:
   a3f21c|CENTRO|SOS|atrapado|apto401|4.6767|-74.0483|1

2. Gateway confirma recepcion al civil:
   ACK|a3f21c

3. Centro despacha la solicitud al operador GRUA07 con la ubicacion:
   c1n7r0|GRUA07|DISP|a3f21c|4.6767|-74.0483|1

4. Operador acepta el viaje (GPS opcional, no bloquea):
   GRUA07|CENTRO|ACC|a3f21c|4.7010|-74.0501

5. Operador va en ruta:
   GRUA07|CENTRO|ST|a3f21c|enruta

6. Operador llega al lugar:
   GRUA07|CENTRO|ST|a3f21c|enlugar

7. Operador marca resuelta:
   GRUA07|CENTRO|ST|a3f21c|rescatado
```

---

## 7. Maquina de estados de la solicitud (estilo Uber)

```
PENDIENTE ──DISP──> DESPACHADA ──ACC──> ACEPTADA ──ST:enruta──> EN_CURSO ──ST:rescatado──> RESUELTA
                                                                     │
                                                          ST:cancelado│
                                                                     v
                                                                 CANCELADA
```

| Estado | Que significa | Disparador de salida |
|---|---|---|
| PENDIENTE | El centro recibio el SOS, nadie asignado. | Mensaje `DISP` del centro. |
| DESPACHADA | El centro asigno la solicitud a un operador. | Mensaje `ACC` del operador. |
| ACEPTADA | El operador tomo el viaje. | Mensaje `ST:enruta`. |
| EN_CURSO | El operador esta en ruta o en el lugar (`enruta`/`enlugar`). | Mensaje `ST:rescatado`. |
| RESUELTA | Rescate completado. | Estado final. |
| CANCELADA | El operador o el centro abortaron. | Estado final. |

Reglas:
- **GPS del operador OPCIONAL y NO bloquea la aceptacion.** El `ACC` sin lat/lon es valido. El GPS
  solo se usa para el ranking "mas cercano" en el centro.
- **Anti-doble-asignacion.** El centro es la unica autoridad de asignacion. Una solicitud en
  `DESPACHADA` o `ACEPTADA` no se re-despacha. Si dos operadores mandan `ACC` para la misma
  `a3f21c`, gana el primero que el centro registra; al segundo el centro le responde con un `ST`
  de la solicitud ya tomada. El `id` de solicitud es la clave unica.
- **Timeouts.** Si `DESPACHADA` no recibe `ACC` en N segundos, el centro re-despacha a otro
  operador (vuelve a `PENDIENTE` internamente y emite un nuevo `DISP`). Si `EN_CURSO` no recibe
  `POS`/`ST` en M minutos, el centro marca la solicitud como sospechosa y pide confirmacion.
- La FSM del navegador (`jakesgordon/javascript-state-machine`) corre en el HTML del operador y en
  el dashboard del centro. Los `onEnter` disparan el envio del mensaje LoRa correspondiente.

---

## 8. Plan de adopcion por bloques (hackathon)

| Bloque | Tarea | Estado |
|---|---|---|
| **Radio** | PHY SX1276 con `radio.begin(915.0, 125.0, 7, 5, 0x12, 20, 8)` | YA EXISTE (RadioLib verificado) |
| **Radio** | ACK + reintento con backoff (firmwares `_bidir`) | YA EXISTE |
| **Radio** | Campo `dst` como 2do token + filtro por software | SE CONSTRUYE (~10 lineas) |
| **Radio** | Dedup por `(from,id)` estilo RadioHead | SE COPIA de OSS (RadioHead, patron) |
| **GPS** | Formato `lat\|lon` texto 5 decimales en el string `\|` | YA EXISTE (extender a 5 dec) |
| **GPS** | GPS del celular via `navigator.geolocation` en el portal | YA EXISTE |
| **GPS** | Enum de `tipo` cerrado | SE CONSTRUYE (contrato de equipo) |
| **Portal** | Portal cautivo WiFi `AYUDA` + formulario (`nodo_portal`) | YA EXISTE |
| **Portal** | Force-open handlers por OS (6 URLs + DNS wildcard) | SE COPIA de OSS (CDFER, reimplementar ~40 lineas) |
| **UI** | FSM del viaje PENDIENTE→...→RESUELTA | SE COPIA de OSS (jakesgordon/javascript-state-machine) |
| **UI** | Mapa con marker de la victima y del operador | SE COPIA de OSS (Leaflet inline + `L.imageOverlay`) |
| **UI** | Dashboard del centro que lee `RECV\|...` por USB | YA EXISTE (`center/center.py`) |
| **UI** | Despacho + aceptacion + estados en la UI | SE CONSTRUYE (sobre la FSM) |

Prioridad de reuso: adoptar > referenciar > construir. El transporte LoRa NO se toca; todo el
valor con menos codigo esta en el front (FSM + mapa) y en el force-open del portal.
