# Protocolo mínimo · Pedir ayuda, reportarse bien, estado de solicitudes

Protocolo compacto para el demo. Corre sobre el frame direccionado ya implementado.
Todo cabe en un paquete LoRa (< 200 bytes). Texto delimitado por `|`, legible por USB.

---

## 1. Frame base (no cambia)

```
ORIGEN | DESTINO | TIPO | MSGID | payload...
```

- `ORIGEN`  : id del que manda. Ej `a3f21c`, `GRUA07`, `CENTRO`.
- `DESTINO` : para quién es. El receptor filtra por este campo. `CENTRO` | `GRUA07` | `BCAST`.
- `TIPO`    : uno de los 7 de abajo.
- `MSGID`   : número de secuencia por nodo. Sirve para el ACK y para descartar duplicados.

Reglas de transporte (ya en firmware): filtro por `DESTINO`, ACK dirigido, anti-duplicados
por `(ORIGEN,MSGID)`, CAD (escucha antes de transmitir), 3 reintentos con backoff.

---

## 2. Los 7 tipos de mensaje

| TIPO | Quién lo manda | Para qué |
|---|---|---|
| `SOS` | civil / rescatista | Pedir ayuda (grúa, médico, rescate, agua). |
| `OK`  | civil | Reportarse a salvo + datos personales (para familia). |
| `DISP`| centro | Despachar una solicitud a un operador. |
| `ACC` | operador | Aceptar la solicitud (estilo Uber). |
| `ST`  | operador / centro | Cambiar el estado de una solicitud. |
| `POS` | cualquiera | Ping de posición. |
| `ACK` | receptor | Confirmar recepción. |

---

## 3. SOS · pedir ayuda (con prioridad)

```
ORIGEN | CENTRO | SOS | MSGID | cat | pri | lat | lon | lugar | detalle
```

- `cat` (categoría): `GRUA` | `MEDICO` | `RESCATE` | `AGUA` | `FUEGO`.
- `pri` (prioridad): entero 0-3. **0 = vida en riesgo**, 1 = alto, 2 = medio, 3 = bajo.
- `lat` / `lon`: decimal 5 dígitos. **Vacíos si se pide por nombre.** Nunca bloquea.
- `lugar`: texto del sitio si no hay GPS. Ej `Portal 80 con calle 13`. Vacío si hay GPS.
- `detalle`: texto corto opcional. Ej `torre B sotano`.

Se puede pedir por **GPS** o por **nombre de lugar**. Al menos uno de los dos debe ir.

Ejemplos literales:

```
# Grúa por GPS, prioridad alta
a3f21c|CENTRO|SOS|7|GRUA|1|4.67670|-74.04830||volcado en sotano

# Grúa por NOMBRE de lugar, sin GPS
a3f21c|CENTRO|SOS|8|GRUA|1|||Portal 80 con calle 13|carro sobre persona

# Asistencia médica, prioridad máxima (vida)
b5k2c9|CENTRO|SOS|3|MEDICO|0|4.70100|-74.05010||herido inconsciente

# Agua/comida, prioridad baja
b5k2c9|CENTRO|SOS|4|AGUA|3|4.65000|-74.05000||familia 4 personas
```

### Triage de prioridad (cómo prioriza el centro)

| pri | Regla | Ejemplos |
|---|---|---|
| **0** | Vida en riesgo inmediato | `MEDICO` inconsciente/hemorragia, `RESCATE` con atrapado, `FUEGO` con gente dentro |
| **1** | Urgente, sin riesgo inmediato de muerte | `GRUA` con persona atrapada consciente, `MEDICO` herido estable |
| **2** | Importante, puede esperar | `RESCATE` de bienes, `GRUA` sin personas |
| **3** | Básico | `AGUA`, `comida`, información |

El centro ordena la cola por `pri` ascendente (0 primero) y, a igual `pri`, por hora de llegada.
El médico y el rescate con atrapado siempre suben arriba.

---

## 4. OK · reportarse bien (datos para familia)

```
ORIGEN | CENTRO | OK | MSGID | nombre | doc | lat | lon | lugar
```

- `nombre`: nombre de la persona. Ej `Juan Perez`.
- `doc`: documento de identidad. Ej `CC1032...`. Clave para que un familiar lo busque.
- `lat` / `lon` / `lugar`: dónde está. Cualquiera de los dos.

Ejemplo:

```
p9m2|CENTRO|OK|1|Juan Perez|CC1032456|4.65000|-74.05000|apto 402 torre 3
```

El centro guarda estos reportes en una lista de "personas a salvo". Si en algún momento
aparece internet, esa lista se sincroniza a un servicio y **un familiar puede consultar por
`doc` o `nombre`** y ver la última posición y hora reportada. Sin internet, la lista vive en
la laptop del centro y se puede mostrar en pantalla.

---

## 5. Despacho y aceptación (estilo Uber)

```
# Centro despacha una solicitud a un operador
CENTRO | GRUA07 | DISP | MSGID | req_id | lat | lon | lugar

# Operador acepta (GPS del operador OPCIONAL, no bloquea)
GRUA07 | CENTRO | ACC | MSGID | req_id

# Cambio de estado
GRUA07 | CENTRO | ST | MSGID | req_id | estado
```

- `req_id`: el `MSGID` original del `SOS`. Identifica la solicitud en todo su ciclo.
- `estado`: `enruta` | `enlugar` | `resuelta` | `cancelada`.

Ejemplos:

```
CENTRO|GRUA07|DISP|12|7|4.67670|-74.04830|
GRUA07|CENTRO|ACC|5|7
GRUA07|CENTRO|ST|6|7|enruta
GRUA07|CENTRO|ST|9|7|resuelta
```

---

## 6. Estado de una solicitud (máquina de estados)

```
PENDIENTE ─DISP─> DESPACHADA ─ACC─> ACEPTADA ─ST:enruta─> EN_CURSO ─ST:resuelta─> RESUELTA
                                                              │
                                                   ST:cancelada│
                                                              v
                                                          CANCELADA
```

| Estado | Significa | Sale con |
|---|---|---|
| PENDIENTE | El centro recibió el SOS, nadie asignado. | `DISP` |
| DESPACHADA | Asignada a un operador, falta que acepte. | `ACC` |
| ACEPTADA | El operador tomó la solicitud. | `ST:enruta` |
| EN_CURSO | El operador va o está en el lugar. | `ST:resuelta` |
| RESUELTA | Terminada. | (final) |
| CANCELADA | Abortada por operador o centro. | (final) |

Reglas:
- El **centro es la única autoridad** que asigna. Una solicitud `DESPACHADA` o `ACEPTADA` no se
  vuelve a despachar. Si dos operadores mandan `ACC` para el mismo `req_id`, gana el primero.
- **GPS del operador opcional, nunca bloquea** la aceptación.
- **Timeout de despacho**: si `DESPACHADA` no recibe `ACC` en N segundos, el centro re-despacha
  a otro operador.

---

## 7. Ejemplo end-to-end (una grúa)

```
1. Civil pide grúa con GPS (prioridad 1):
   a3f21c|CENTRO|SOS|7|GRUA|1|4.67670|-74.04830||volcado en sotano
2. Centro confirma:
   CENTRO|a3f21c|ACK|7
3. Centro despacha a GRUA07:
   CENTRO|GRUA07|DISP|12|7|4.67670|-74.04830|
4. Operador acepta:
   GRUA07|CENTRO|ACC|5|7
5. Operador en ruta:
   GRUA07|CENTRO|ST|6|7|enruta
6. Operador resuelve:
   GRUA07|CENTRO|ST|9|7|resuelta
```

---

## 8. Tamaños (todos caben de sobra)

| Mensaje | Bytes aprox | Airtime SF7 |
|---|---|---|
| SOS con GPS | 45-55 | ~90-103 ms |
| OK con datos | 45-60 | ~90-110 ms |
| DISP | 40-48 | ~82-90 ms |
| ACC | 22-26 | ~62 ms |
| ST | 26-32 | ~72 ms |
| ACK | 10 | ~41 ms |

Máximo por paquete: 255 bytes. Ningún mensaje pasa de ~60. No hay que fragmentar.

---

## 9. Enums cerrados (para no equivocarse)

```
cat    = GRUA | MEDICO | RESCATE | AGUA | FUEGO
pri    = 0 | 1 | 2 | 3          (0 = vida en riesgo)
estado = enruta | enlugar | resuelta | cancelada
dst    = CENTRO | GRUA07 | BCAST
tipo   = SOS | OK | DISP | ACC | ST | POS | ACK
```
