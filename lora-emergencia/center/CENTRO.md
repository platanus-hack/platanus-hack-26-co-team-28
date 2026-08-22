# Centro de control · guía para el dev

Esta guía es para construir y extender el **módulo del centro de operaciones**. El centro
es software que corre en una laptop, lee el gateway LoRa por USB, y muestra un tablero.
No necesitas tocar el firmware de las placas. Todo el contrato está aquí.

Autor base: firmware + `center.py` de referencia ya funcionando. Tú lo llevas a producción.

---

## 1. Qué es el centro

```
[Placa gateway "CENTRO"] --USB serial--> [Laptop: tu módulo] --HTTP--> [Navegador: tablero]
        ^                                        |
        | LoRa 915                               | escribe "TX|..." para despachar
        v                                        v
   otras placas (rescatista, operador)      opcional: sync a internet
```

- El centro **lee** las líneas que el gateway imprime por USB (reportes que llegan por LoRa).
- El centro **escribe** líneas `TX|...` al gateway para transmitir mensajes por LoRa (despacho).
- El centro mantiene el estado (solicitudes, personas a salvo, máquina de estados) y sirve el tablero.

Hay un `center.py` de referencia que ya hace lo básico. Puedes extenderlo o reescribir en tu stack.

---

## 2. Cómo correrlo hoy

```bash
pip install pyserial            # o: pip install pyserial --break-system-packages
python3 center.py /dev/cu.usbserial-XXXX    # el puerto del gateway
# abre http://localhost:8080

# Sin hardware, con datos de ejemplo:
python3 center.py --demo
```

Encuentra el puerto con `arduino-cli board list` o `ls /dev/cu.usbserial-*`.
Baud: **115200**.

---

## 3. Interfaz de ENTRADA (lo que el gateway imprime por USB)

Lee líneas de texto terminadas en `\n`. Solo te importan dos prefijos. Ignora el resto
(las líneas `[GATEWAY] ...` son logs de depuración).

### SOS · solicitud de ayuda
```
SOS|node|cat|pri|lat|lon|lugar|detalle|seq|RSSI:x|SNR:y
```
Ejemplos reales:
```
SOS|a3f21c|MEDICO|0|4.67670|-74.04830|-|inconsciente|3|RSSI:-27.00|SNR:9.25
SOS|a3f21c|GRUA|1|||Portal 80 con calle 13|carro sobre persona|8|RSSI:-31.00|SNR:9.00
```
Campos:
| Campo | Significado |
|---|---|
| `node` | id del nodo que envió (ej `a3f21c`). |
| `cat` | `GRUA` \| `MEDICO` \| `RESCATE` \| `AGUA` \| `FUEGO`. |
| `pri` | prioridad 0-3. **0 = vida en riesgo**. Ordena la cola por esto. |
| `lat`/`lon` | decimal. **Pueden venir vacíos** si el reporte fue por nombre de lugar. |
| `lugar` | texto del sitio si no hubo GPS. `-` si vacío. |
| `detalle` | texto corto. `-` si vacío. |
| `seq` | id del mensaje en el nodo origen. Úsalo con `node` para no duplicar. |
| `RSSI`/`SNR` | calidad del enlace. |

### SALVO · persona a salvo (con datos identificables)
```
SALVO|node|nombre|doc|lat|lon|lugar|seq|RSSI:x|SNR:y
```
Ejemplo:
```
SALVO|p9m2|Juan Perez|CC1032456|4.65000|-74.05000|apto 402|1|RSSI:-40.00|SNR:9.80
```
`nombre` y `doc` (documento) son la clave para que un familiar busque a la persona.

### Idempotencia
El mismo `(node, seq)` puede llegar dos veces (reenvío por LoRa). **Descarta el duplicado.**
El gateway ya filtra duplicados en el aire, pero protege también en el centro.

---

## 4. Interfaz de SALIDA (despachar por LoRa desde el centro)

Para mandar un mensaje por LoRa (ej. despachar una solicitud a un operador), **escribe una
línea `TX|<frame>\n` al puerto serial del gateway**. El gateway la transmite tal cual, con
CAD (listen-before-talk).

```
TX|CENTRO|GRUA07|DISP|12|7|4.67670|-74.04830|
```
Esto transmite el frame `CENTRO|GRUA07|DISP|12|7|4.67670|-74.04830|` por LoRa.
El nodo `GRUA07` lo recibe (los demás lo ignoran por el filtro de destino).

Ejemplo en Python:
```python
ser.write(b"TX|CENTRO|GRUA07|DISP|12|7|4.67670|-74.04830|\n")
```

El `MSGID` del DISP lo pones tú (un contador del centro). El `req_id` (aquí `7`) es el `seq`
del SOS original, para seguir la solicitud en todo su ciclo.

---

## 5. Protocolo de mensajes (referencia)

Todo frame LoRa: `ORIGEN|DESTINO|TIPO|MSGID|payload`. Detalle completo y todos los tipos
(`SOS`, `OK`, `DISP`, `ACC`, `ST`, `POS`, `ACK`) en **[`../docs/PROTOCOLO-MINIMO.md`](../docs/PROTOCOLO-MINIMO.md)**.

Los que produce/consume el centro:
- Recibe: `SOS`, `OK`, y (cuando exista el operador físico) `ACC`, `ST`.
- Emite (por `TX|`): `DISP` (despacho), y opcional `ACK`/`ST` de vuelta al civil.

---

## 6. Modelo de datos sugerido

**Solicitud (request):**
```json
{
  "id": 1,                 // id interno del centro
  "node": "a3f21c",        // nodo origen
  "seq": "3",              // req_id: seq del SOS. clave para el ciclo
  "cat": "MEDICO", "pri": 0,
  "lat": "4.67670", "lon": "-74.04830", "lugar": "-", "detalle": "inconsciente",
  "estado": "PENDIENTE",
  "operador": null,        // a quién se despachó (ej GRUA07)
  "rssi": "-27.00", "snr": "9.25", "t": 1787439152.0
}
```

**Persona a salvo (safe):**
```json
{ "node":"p9m2", "nombre":"Juan Perez", "doc":"CC1032456",
  "lat":"4.65000", "lon":"-74.05000", "lugar":"apto 402", "t": 1787439100.0 }
```

---

## 7. Máquina de estados de la solicitud (estilo Uber)

```
PENDIENTE ─DISP─> DESPACHADA ─ACC─> ACEPTADA ─ST:enruta─> EN_CURSO ─ST:resuelta─> RESUELTA
                                                              │
                                                   ST:cancelada│
                                                              v
                                                          CANCELADA
```

Reglas que el centro debe imponer:
- El centro es la **única autoridad** de asignación. Una solicitud `DESPACHADA` o `ACEPTADA` no
  se vuelve a despachar.
- **Anti-doble-asignación**: si dos operadores mandan `ACC` para el mismo `req_id`, gana el primero.
- **GPS del operador opcional, nunca bloquea** la aceptación.
- **Timeout de despacho**: si `DESPACHADA` no recibe `ACC` en N segundos, re-despacha a otro operador.

Hoy, sin nodo de operador físico, el centro **simula** al operador con botones
(Despachar → Aceptar → En curso → Resolver). Cuando llegue la 3ª placa, `ACC` y `ST` llegarán
por LoRa como líneas de entrada.

---

## 8. API HTTP del center.py de referencia

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/` | Sirve el tablero HTML. |
| GET | `/api/state` | JSON `{requests:[...], safe:[...]}`. |
| POST | `/api/estado?id=<id>&estado=<ESTADO>` | Cambia el estado de una solicitud. |

Extiéndela con: `/api/dispatch?id=&operador=` (que además escriba `TX|...DISP...` al gateway),
persistencia, y un endpoint de búsqueda de personas a salvo por `doc`/`nombre`.

---

## 9. Qué construir / extender (roadmap)

Prioridad alta:
1. **Despacho real por LoRa**: al despachar en el tablero, escribir `TX|CENTRO|<operador>|DISP|...`
   al gateway. Ya existe la interfaz `TX|` (sección 4). Falta cablearla en la UI.
2. **Persistencia**: guardar solicitudes y personas a salvo en SQLite/JSON. Sobrevive reinicios.
3. **Búsqueda de personas a salvo** por documento o nombre (la lista ya existe en memoria).

Prioridad media:
4. **Mapa offline**: hoy el tablero usa Leaflet por CDN (necesita internet). Cambiar a tiles
   locales o a `L.imageOverlay` con una imagen estática de la zona. Ver `../docs/OSS-Y-PROTOCOLO.md`.
5. **Sync a internet cuando aparezca**: subir la lista de personas a salvo a un servicio para que
   familiares consulten por `doc`. Sin internet, la lista vive local.
6. **Multi-operador**: manejar varios nodos de grúa y elegir el más cercano si mandan su `POS`.

Prioridad baja:
7. Autenticación del tablero, roles (autoridad vs brigadista), export de reportes.

---

## 10. Notas de hardware que afectan al centro

- **Airtime LoRa es el límite real**, no el WiFi. A SF7/BW125 el canal sano da ~20 intercambios
  por minuto para toda la malla. No inundes el canal con polling. Manda `DISP` solo cuando haga falta.
- El gateway ya hace **filtro por destino, ACK dirigido, anti-duplicados y CAD**. Confía en eso.
- Todas las placas deben tener los **mismos parámetros LoRa**: `915.0, BW125, SF7, CR4/5, sync 0x12`.
  Si un nodo no aparece, revisa esto primero.
- El puerto USB puede reconectarse; `center.py` ya reintenta abrir el serial. Mantén ese patrón.
```
```
