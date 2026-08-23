<img src="./project-logo.png" alt="WOKI" width="140" />

# WOKI · Red de emergencia sin internet

**Track: 🚨 Emergencies · team-28 · Platanus Hack 26 Bogotá**

Cuando un terremoto tumba la red celular, pedir ayuda deja de ser un problema de
interfaz y se vuelve un problema de comunicación. WOKI abre un camino local entre
la persona afectada y el puesto de mando, sin depender de internet.

```text
📱 Celular → WiFi abierto del nodo → LoRa 915 MHz → Gateway → Centro local (Raspberry Pi)
                                                                    ↕ (cuando vuelve la red)
                                                              Hub online de solo lectura
```

**Hub online:** <https://woki-hub.vercel.app>

---

## Features

### 1. Entrar a la red: sin app, sin contraseña

El nodo levanta una red WiFi **abierta**, sin contraseña, con un nombre que se
entiende solo: `[AFECTADOS] RED DE AYUDA WOKI`. Conectarse es toda la instalación
que hay que hacer. No hay descarga, no hay cuenta, no hay clave que repartir en
medio de una emergencia.

Como la red no tiene contraseña, **cualquier forma de acercar a la gente al nodo
sirve igual de bien**: un tag NFC pegado en un poste o en el kit, un QR impreso,
una URL dictada por radio o simplemente ver la red en la lista de WiFi del
teléfono. El tag NFC está pensado como pieza física de distribución —algo que se
pega en puntos de la ciudad o se reparte con el kit para que acercar el teléfono
baste—, pero es una comodidad, nunca un requisito: si no hay tag, la red sigue
estando ahí, visible y abierta para todos.

> **Estado:** red abierta y descubrimiento por WiFi/URL — *validado en hardware*.
> Tag NFC y QR impreso — *definidos*, aún sin implementar.

### 2. Portal cautivo: pedir ayuda en dos toques

Al conectarse, el teléfono abre solo el portal (`nodo_portal_https`, HTTPS sobre
el ESP32). Ahí la persona elige **qué necesita** —`RESCATE`, `MEDICO`, `FUEGO`,
`AGUA`, `GRUA`— o se reporta **a salvo** para que su familia lo sepa.

Dos decisiones de diseño que importan bajo estrés:

- **La ubicación nunca bloquea.** Primero se pide ayuda; el GPS se ofrece
  después. Si el teléfono no lo da, se escribe el lugar a mano
  (`Portal 80 con calle 13`) y el reporte sale igual.
- **La pantalla sigue el estado en vivo.** El ciudadano ve su solicitud pasar de
  recibida a aceptada, en ruta y resuelta, sin refrescar ni volver a conectarse.

> **Estado:** *validado en hardware* (iOS abre el portal solo; Android a veces
> pide entrar a `192.168.4.1`).

### 3. Triage: prioridad antes que orden de llegada

Cada solicitud viaja con **categoría** y **prioridad 0–3**, donde `0 = vida en
riesgo`, `1` alto, `2` medio, `3` bajo. El centro no atiende por orden de
llegada: ordena por `(prioridad, hora)`, así una fractura expuesta no queda
detrás de una solicitud de agua que llegó primero.

El ciclo de vida de un incidente es explícito y auditable:

```text
PENDIENTE → ACEPTADA → EN_CURSO → RESUELTA
                    ↘ CANCELADA
```

El operador puede **elevar la prioridad al despachar** si el contexto lo amerita,
y cada transición queda registrada con su origen en el timeline del incidente.
**El despacho siempre requiere autorización humana**: el sistema recomienda
recursos compatibles, no decide solo.

> **Estado:** *implementado* y verificado con pruebas automáticas del ciclo
> completo (SOS → triage → despacho → aceptación → trayecto → resolución).

### 4. Radio LoRa: el canal que sobrevive

Placas **LilyGO TTGO LoRa32** (SX1276, 915 MHz) mueven paquetes cortos de texto
—menos de 200 bytes— entre los nodos y el gateway. El protocolo es direccionado
y legible por serial:

```text
ORIGEN | DESTINO | TIPO | MSGID | payload...
```

Diez tipos de mensaje cubren toda la operación: `SOS` (pedir ayuda), `OK`
(reportarse a salvo), `DISP` (despachar), `ACC` (aceptar, estilo Uber), `ST`
(cambio de estado), `POS`, `HB` (heartbeat del recurso), `BC` / `BCA`
(broadcast y su confirmación) y `ACK`.

El transporte asume que la radio falla: filtro por destino, **ACK dirigido**,
anti-duplicados por `(ORIGEN, MSGID)`, CAD y hasta 3 reintentos con backoff. Y
el canal es **bidireccional**: el centro despacha misiones y emite broadcasts
por zona o globales, y los estados vuelven hasta la pantalla del ciudadano.

> **Estado:** enlace, ACK y canal de vuelta — *validados en hardware*.

### 5. Command center local: la fuente de verdad

En la Raspberry Pi (o una laptop), `center/` guarda todo en **SQLite**, muestra
un tablero en vivo con mapa offline, cola de solicitudes filtrable, estado de
recursos, broadcasts y personas a salvo. Funciona con la red caída porque nunca
dependió de ella.

> **Estado:** *implementado*, con cartografía offline en la máquina local.

### 6. Onboarding: armar un kit sin saber de hardware

`/setup` en el Hub es un asistente visual de **nueve pasos** que va desde
conseguir el proyecto hasta verificar el recorrido completo, pasando por la
antena, el LoRa maestro, el esclavo y las piezas 3D imprimibles. Tres detalles
que bajan la fricción:

- **Modo simulación:** se puede recorrer entero sin tener las placas enfrente.
- **Narración por voz en español** en cada paso.
- **Prompt copiable** para pegar en ChatGPT o Claude, que acompaña tanto a una
  persona técnica como a una que nunca soldó nada. Un prompt aparte compara
  stock, compatibilidad, tiendas cercanas y costo del kit en moneda local.

Para quien prefiere terminal, `scripts/instalar_maestro.sh` e
`instalar_esclavo.sh` hacen lo mismo sin pasar por el navegador.

> **Estado:** *implementado*; no modifica dispositivos por sí solo.

### 7. Hub online: visibilidad, no dependencia

Cuando vuelve internet, el centro local vacía su **outbox** contra un hub de
**solo lectura**: overview con mapa, solicitudes, recursos, trazabilidad de red,
broadcasts y personas a salvo. La ingesta es idempotente, así que reintentar es
seguro; si la nube falla, la operación local continúa y la cola espera.

El hub **no ejecuta acciones críticas**. Muestra información: la autorización de
despacho vive en el centro local. Las posiciones se redondean y los nombres y
documentos de personas a salvo nunca salen del sitio.

> **Estado:** *implementado* y desplegado.

---

## Probarlo en 3 minutos

Sin hardware, solo el tablero:

```bash
cd lora-emergencia
pip install pyserial
python3 center/center.py --demo   # abre http://localhost:8080
```

Con dos placas TTGO:

```bash
./scripts/flash.sh nodo_portal_https /dev/cu.usbserial-AAAA   # nodo + portal
./scripts/flash.sh gateway_bidir     /dev/cu.usbserial-BBBB   # gateway
python3 center/center.py /dev/cu.usbserial-BBBB
# Conecta el celular a la red "[AFECTADOS] RED DE AYUDA WOKI" y pide ayuda.
```

⚠️ **Nunca energices una placa sin la antena enroscada.** Transmitir sin antena
daña el amplificador de forma permanente.

---

## Documentación

| Quiero… | Leer |
|---|---|
| El relato para jurados | [`project-description.md`](project-description.md) |
| La topología completa | [`docs/ARQUITECTURA-CONEXIONES.md`](docs/ARQUITECTURA-CONEXIONES.md) |
| El protocolo de radio vigente | [`lora-emergencia/docs/PROTOCOLO-MINIMO.md`](lora-emergencia/docs/PROTOCOLO-MINIMO.md) |
| Armar y flashear el hardware | [`lora-emergencia/README.md`](lora-emergencia/README.md) |
| Operar el centro y sincronizar | [`docs/OPERAR-SINCRONIZACION.md`](docs/OPERAR-SINCRONIZACION.md) |
| El índice completo | [`docs/README.md`](docs/README.md) |

Cada capacidad en la documentación se marca como **implementada**, **validada en
hardware**, **definida** o **investigada**. No usamos "funciona" para algo que
solo está diseñado.

---

## Equipo

- Juan Ortega ([@juanortega10](https://github.com/juanortega10))
- Nicolas Vargas ([@MrUprizing](https://github.com/MrUprizing))
- Jhomar Astuyauri Herencia ([@asther0](https://github.com/asther0))
- Emmy Daniela Arias Pardo ([@estparcae](https://github.com/estparcae))
- Manuel Torres ([@amunm9](https://github.com/amunm9))

**WOKI funciona cuando internet no funciona.**
