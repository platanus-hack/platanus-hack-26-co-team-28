# Centro de control · guía operativa

Esta guía describe el command center que corre en una Raspberry Pi, controla el gateway LoRa por USB y sirve un dashboard enteramente local.

## 1. Responsabilidades

```text
Dashboard web
     │
Raspberry Pi — autoridad operacional y persistencia
     │ USB serial bidireccional
TTGO "CENTRO" — gateway/adaptador de radio
     │ LoRa 915 MHz
TTGO recursos y nodos civiles
```

- La Raspberry decide asignaciones, estados y broadcasts.
- El gateway transmite, recibe y reporta métricas; no contiene reglas de negocio.
- Los nodos civiles originan `SOS` y `OK`.
- Los nodos recurso reciben `DISP`/`BC` y originan `ACC`, `ST`, `POS` y `HB`.

“Maestro” significa autoridad del protocolo del proyecto. LoRa punto a punto no ofrece por sí solo una jerarquía maestro/esclavo.

## 2. Ejecución

Modo demo persistente solo durante el proceso:

```bash
cd lora-emergencia/center
python3 center.py --demo
```

Con gateway real y SQLite:

```bash
pip install -r requirements.txt
python3 center.py /dev/cu.usbserial-GATEWAY --db center.db
```

En Raspberry Pi el puerto suele ser `/dev/ttyUSB0`. El dashboard queda en `http://localhost:8080` o en la IP local de la Pi.

La preparación completa del entorno está en [`TOOLCHAIN.md`](TOOLCHAIN.md).

## 3. Contrato USB

Todas las líneas terminan en `\n` y usan baud `115200`.

### Raspberry → gateway

```text
TX|<ORIGEN>|<DESTINO>|<TIPO>|<MSGID>|<payload...>
```

Ejemplo de despacho:

```text
TX|CENTRO|GRUA07|DISP|12|CIVIL1|7|4.67670|-74.04830|-|GRUA|1|volcado
```

### Gateway → Raspberry

```text
RX|<frame completo>|RSSI:-71.50|SNR:8.25
ACK|GRUA07|CENTRO|12|RSSI:-70.00|SNR:8.50
TX_SENT|CENTRO|GRUA07|DISP|12
TX_ERROR|12|-6
GATEWAY_READY|CENTRO|1
RADIO_ERROR|RX_READ|-7
```

`RX` transporta cualquier tipo de uplink. La Raspberry analiza el frame, no logs específicos por tipo.

## 4. Identidad de solicitudes

Una solicitud se identifica globalmente por:

```text
(request_origin, request_message_id)
```

No basta un `req_id` numérico: dos nodos pueden producir el mismo número de secuencia.

Por eso `DISP`, `ACC` y `ST` incluyen ambos campos:

```text
CENTRO|GRUA07|DISP|12|CIVIL1|7|lat|lon|lugar|categoria|prioridad|detalle
GRUA07|CENTRO|ACC|21|CIVIL1|7
GRUA07|CENTRO|ST|22|CIVIL1|7|enruta
```

## 5. Flujo de despacho

```text
1. CIVIL1 → CENTRO: SOS 7
2. Gateway → CIVIL1: ACK 7
3. Operador asigna GRUA07 en el dashboard
4. Raspberry → gateway: TX|...DISP 12...CIVIL1|7
5. Gateway → GRUA07: DISP 12
6. GRUA07 → gateway: ACK 12
7. Gateway → Raspberry: ACK|GRUA07|CENTRO|12
8. Raspberry marca DESPACHADA
9. Persona pulsa Aceptar en la web de GRUA07
10. GRUA07 → CENTRO: ACC ... CIVIL1|7
11. Raspberry marca ACEPTADA
```

La solicitud solo pasa a `DESPACHADA` cuando llega el ACK técnico del recurso. La aceptación humana es un mensaje `ACC` posterior.

## 6. Máquina de estados

```text
PENDIENTE → DESPACHADA → ACEPTADA → EN_CURSO → RESUELTA
                  └──────────┴──────────────→ CANCELADA
```

- Solo `PENDIENTE` puede despacharse.
- Solo el recurso asignado puede aceptar o cambiar estado.
- `ACC` lleva de `DESPACHADA` a `ACEPTADA`.
- `ST:enruta` lleva a `EN_CURSO`.
- `ST:resuelta` solo resuelve una solicitud en curso.
- El origen y secuencia del SOS evitan colisiones y doble asignación.

## 7. Broadcast

Formato inicial:

```text
CENTRO|BCAST|BC|MSGID|scope|priority|expiry_epoch|message
```

Scopes implementados:

```text
ALL
ZONE:NORTE
```

El centro repite el broadcast tres veces. Los nodos no responden con ACK grupal inmediato; programan una confirmación `BCA` con retraso aleatorio.

```text
GRUA07|CENTRO|BCA|MSGID_PROPIO|BROADCAST_MSGID
```

Esto reduce la probabilidad de una tormenta de respuestas. El seguimiento detallado de confirmación humana todavía está pendiente.

## 8. Nodo recurso

Antes de flashear `nodo_recurso`, configura:

```cpp
const char* RESOURCE_ID = "GRUA07";
const char* RESOURCE_TYPE = "GRUA";
String RESOURCE_ZONE = "NORTE";
```

El nodo crea una WiFi `RECURSO_GRUA07`. En `http://192.168.4.1` muestra:

- Asignación vigente.
- Último broadcast.
- Aceptar.
- En ruta.
- En el lugar.
- Resolver.

El OLED es un adapter pendiente porque no todas las T3 V1.6.1 lo incluyen y requiere validar el modelo físico.

## 9. Persistencia

SQLite conserva:

- Solicitudes y estados.
- Personas a salvo.
- Recursos y última posición.
- Mensajes originales.
- Secuencia de mensajes del centro.

La idempotencia se aplica por `(node, seq)`. La base predeterminada es `center.db`.

## 10. Qué está implementado

- Gateway no bloqueante para atender serial y radio.
- Contrato USB universal y estructurado.
- ACK correlacionado y tres intentos para despachos dirigidos.
- Nodo recurso con recepción continua y web local.
- Despacho y aceptación separados.
- `ACC`, `ST`, `POS` y `HB` procesados por el centro.
- SQLite.
- Dashboard sin dependencias CDN.
- Broadcast global y zonal básico.
- Pruebas unitarias del dominio y parser.

## 11. Pendiente de validación o producto

- Prueba end-to-end real con al menos gateway y nodo recurso.
- OLED del modelo físico disponible.
- Tiles cartográficos offline; hoy existe un plano esquemático de coordenadas.
- Captura periódica de GPS del celular del recurso.
- Confirmación humana de broadcasts.
- Autenticación/cifrado de frames y minimización de datos personales.
- Failover automático al segundo gateway.
- Cache de deduplicación más amplio y sesión de arranque de cada nodo.
- Políticas agentic y autorización por rol.

No se debe presentar ninguno de estos puntos como resuelto hasta probarlo en hardware o implementarlo explícitamente.
