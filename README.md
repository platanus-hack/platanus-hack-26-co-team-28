<img src="./project-logo.png" alt="WOKI" width="140" />

# WOKI · Red de emergencia sin internet

**Track: 🚨 Emergencies · team-28 · Platanus Hack 26 Bogotá**

![Hardware: ESP32 + LoRa 915 MHz](https://img.shields.io/badge/Hardware-ESP32_%2B_LoRa_915_MHz-111111?style=flat-square)
![Firmware: C++ + Arduino](https://img.shields.io/badge/Firmware-C%2B%2B_%2B_Arduino-111111?style=flat-square)
![Offline: Python + SQLite](https://img.shields.io/badge/Offline-Python_%2B_SQLite-111111?style=flat-square)
![Web: Next.js + React](https://img.shields.io/badge/Web-Next.js_%2B_React-111111?style=flat-square)
![Cloud: Supabase + Vercel + Render](https://img.shields.io/badge/Cloud-Supabase_%2B_Vercel_%2B_Render-111111?style=flat-square)

> Pedir ayuda y coordinar rescates sin internet, con visibilidad remota cuando vuelve la red.

Cuando un terremoto tumba la red celular, pedir ayuda deja de ser un problema de interfaz y se
vuelve un problema de comunicación. WOKI abre un camino local entre la persona afectada y el puesto
de mando, sin depender de internet.

```text
Celular → WiFi local → TTGO Esclavo → LoRa 915 MHz → TTGO Maestro → USB
                                                                     ↓
                                                     Centro Python + SQLite
                                                                     ↓ internet disponible
                                                        Vercel → Supabase
```

## Servicios locales y offline

| Servicio | Red o conexión | Dirección local | Qué permite hacer |
|---|---|---|---|
| Punto de ayuda | WiFi abierto **`[AFECTADOS] RED DE AYUDA WOKI`** | Portal cautivo; acceso manual en `https://ayuda.homiapp.xyz/` o `192.168.4.1` | Pedir ayuda, compartir la ubicación o reportarse a salvo desde cualquier celular, sin instalar una app |
| Portal del recurso | WiFi abierto **`RECURSO_<ID>`**, por ejemplo `RECURSO_GRUA07` | `http://192.168.4.1` | Recibir una misión o broadcast y confirmar su aceptación por LoRa |
| LoRa Maestro | Radio LoRa 915 MHz + USB serial | No publica una URL; usa `/dev/ttyUSB0` en Raspberry Pi o `/dev/cu.usbserial-*` en macOS | Conectar los nodos de campo con el Centro local |
| Command Center local | Raspberry Pi o laptop del puesto de mando | `http://localhost:8080` | Operar solicitudes, mapa, recursos, broadcasts y personas a salvo con SQLite, aun sin internet |
| Diagnóstico local | Mismo equipo del Centro | `http://localhost:8080/health` y `http://localhost:8080/api/v1/overview` | Verificar el Centro e integrar clientes locales |

Todos estos servicios operan sin internet. La dirección `192.168.4.1` se repite porque cada nodo
crea su propia red WiFi aislada: el celular debe conectarse primero al SSID correcto. Por seguridad,
el instalador expone el Centro solo en la misma laptop o Raspberry. Compartirlo en la LAN requiere
iniciarlo deliberadamente con `--host 0.0.0.0` y un `--api-token`; entonces se abre en
`http://<IP-DEL-CENTRO>:8080`.

## Todos los enlaces públicos

| Experiencia | URL | Qué demuestra | Alcance |
|---|---|---|---|
| **Entrega principal** | [Hub WOKI](https://woki-hub.vercel.app) | Entrada, onboarding y réplica online | URL oficial del concurso |
| Configuración guiada | [Preparar kit](https://woki-hub.vercel.app/setup) | Instalación del Maestro y Esclavo, voz y piezas 3D | Simulable sin dispositivos |
| Centro online | [Command Center](https://woki-hub.vercel.app/command-center) | Módulos operacionales con datos sincronizados | Réplica de solo lectura |
| Centro Python | [Demo en Render](https://woki-command-center-demo.onrender.com) | Centro local interactivo con datos sintéticos | Sin hardware ni sincronización externa; puede tardar en despertar |
| Diseño físico | [Visor 3D](https://woki-lora-enclosures.vercel.app) | Archivos STL/3MF listos para descargar e imprimir | Extensión física opcional |
| Flujo LoRa | [Visualización](https://lora.uprizing.me) | Recorrido conceptual entre celulares, nodos y Centro | Apoyo visual, no dependencia operacional |

El campo `deploy-url` de [`platanus-hack-project.jsonc`](./platanus-hack-project.jsonc) apunta al
Hub principal. Los demás despliegues son evidencia complementaria.

## Frictionless por diseño

- **Instalación asistida:** el onboarding visual entrega prompts breves y especializados para que
  ChatGPT, Claude u otro agente de IA acompañe el setup. Para perfiles técnicos, dos comandos
  instalan Arduino CLI, ESP32, librerías, firmware y Python sin requerir Arduino IDE.
- **Operación con triage:** el Centro prioriza la demanda y recomienda cómo distribuir recursos
  compatibles; el operador humano conserva la decisión sobre cada despacho crítico.
- **Acceso ciudadano sin app:** al conectarse a **`[AFECTADOS] RED DE AYUDA WOKI`** se abre el
  portal cautivo para pedir ayuda en pocos pasos. Los tags NFC/QR están definidos para instalarse
  en columnas y puntos seguros y facilitar el ingreso a la red; esta capa física aún debe validarse
  en campo.

## Cómo funciona

### 1. Portal local, sin app

El nodo afectado ofrece una red WiFi abierta y un portal servido por el ESP32. La persona elige
`RESCATE`, `MEDICO`, `FUEGO`, `AGUA` o `GRUA`, o se reporta a salvo. Después puede compartir GPS o
describir el lugar manualmente. La pantalla sigue el estado: recibida, aceptada, en ruta y resuelta.

### 2. LoRa bidireccional

Las placas LilyGO TTGO LoRa32 transportan paquetes cortos por SX1276 a 915 MHz. El protocolo usa
destino, identificador de mensaje, ACK, deduplicación, CAD y reintentos. El Centro recibe reportes y
también envía despachos, estados y broadcasts a los recursos.

### 3. Centro local como fuente de verdad

Una Raspberry Pi o laptop ejecuta el Centro Python. SQLite conserva solicitudes, recursos,
timeline, personas a salvo y una outbox durable. El mapa, triage y dashboard operan offline. El
sistema recomienda recursos compatibles, pero una persona autoriza cada despacho crítico.

```text
PENDIENTE → ACEPTADA → EN_CURSO → RESUELTA
                    ↘ CANCELADA
```

### 4. Sincronización eventual

Cuando vuelve internet, el Centro envía su outbox al endpoint autenticado de Vercel. Supabase
ingiere cada evento de forma idempotente y el Hub muestra una réplica de solo lectura. Si Vercel,
Supabase o internet fallan, la operación local continúa y la cola reintenta después.

### 5. Onboarding guiado

El Hub guía nueve pasos desde la descarga del proyecto hasta la verificación completa, incluyendo
antenas, Maestro, Esclavo, WiFi local y piezas imprimibles. El modo simulación permite entender el
recorrido sin disponer todavía del hardware.

## Estado demostrado

| Capacidad | Estado |
|---|---|
| Portal cautivo y envío desde celular | Validado en hardware |
| LoRa, ACK y canal bidireccional | Validado en hardware |
| SOS, triage, despacho, aceptación, trayecto y resolución | Implementado y probado automáticamente |
| Centro Python, SQLite y mapa offline | Implementado |
| Outbox, ingesta idempotente y Hub online | Implementado y desplegado |
| Onboarding, voz en español y prompts de soporte | Implementado y desplegado |
| NFC y QR para descubrir la red | Definido, todavía no implementado |
| Carcasas y bandejas 3D | Diseñadas; validar tolerancias físicas antes de campo |

## Stack tecnológico

| Capa | Tecnología | Responsabilidad |
|---|---|---|
| Hardware | LilyGO TTGO LoRa32 T3 V1.6.1, ESP32-PICO-D4, SX1276 | Nodos de campo y Gateway Maestro |
| Firmware | C++/Arduino, RadioLib, WiFi SoftAP | Portal local y protocolo LoRa 915 MHz |
| Centro offline | Python 3, SQLite WAL, pyserial | Radio, persistencia, triage, API y sincronizador |
| Mapas | Leaflet, VectorGrid, MBTiles, OpenStreetMap/Geofabrik | Cartografía local y online |
| Hub online | Next.js 16, React 19, TypeScript, Bun | Onboarding y Command Center sincronizado |
| Datos online | Supabase Postgres, RLS y RPC idempotente | Réplica segura de eventos operacionales |
| Despliegue | Vercel y Render | Hub principal y demo aislada del Centro Python |
| Onboarding | ElevenLabs Multilingual v2 + prompts para ChatGPT/Claude | Guía de voz y acompañamiento de instalación |
| Diseño físico | OpenSCAD, STL/3MF y Three.js | Carcasas y visor de piezas imprimibles |

## Probarlo

### Camino guiado

Abre <https://woki-hub.vercel.app/setup>. El modo simulación está activo por defecto.

### Camino técnico

Clona el repositorio y conecta siempre la antena de 915 MHz antes de energizar una placa.

```bash
git clone https://github.com/platanus-hack/platanus-hack-26-co-team-28.git
cd platanus-hack-26-co-team-28
```

Prepara el Gateway Maestro y el Centro en macOS o Linux:

```bash
bash lora-emergencia/scripts/instalar_maestro.sh
```

Prepara un nodo Esclavo/Recurso:

```bash
bash lora-emergencia/scripts/instalar_esclavo.sh
```

Sin hardware, inicia solamente el Centro con datos sintéticos:

```bash
cd lora-emergencia/center
python3 center.py --demo
```

⚠️ **Nunca energices una placa sin la antena enroscada.** Transmitir sin antena puede dañar el
amplificador de radio.

## Documentación

| Quiero… | Leer |
|---|---|
| El relato para jurados | [`project-description.md`](project-description.md) |
| La topología completa | [`docs/ARQUITECTURA-CONEXIONES.md`](docs/ARQUITECTURA-CONEXIONES.md) |
| Operar el Centro y sincronizar | [`docs/OPERAR-SINCRONIZACION.md`](docs/OPERAR-SINCRONIZACION.md) |
| Revisar el hardware compatible | [`lora-emergencia/docs/HARDWARE.md`](lora-emergencia/docs/HARDWARE.md) |
| Entender el protocolo de radio | [`lora-emergencia/docs/PROTOCOLO-MINIMO.md`](lora-emergencia/docs/PROTOCOLO-MINIMO.md) |
| Preparar el portal cautivo | [`lora-emergencia/docs/PORTAL-CAUTIVO-E2E.md`](lora-emergencia/docs/PORTAL-CAUTIVO-E2E.md) |
| Fabricar las piezas 3D | [`lora-emergencia/diseno-3d/README.md`](lora-emergencia/diseno-3d/README.md) |
| Navegar toda la documentación | [`docs/README.md`](docs/README.md) |

Cada capacidad se marca como **implementada**, **validada en hardware**, **definida** o
**investigada**. No usamos “funciona” para algo que solo está diseñado.

## Equipo

- Juan Ortega ([@juanortega10](https://github.com/juanortega10))
- Nicolas Vargas ([@MrUprizing](https://github.com/MrUprizing))
- Jhomar Astuyauri Herencia ([@asther0](https://github.com/asther0))
- Emmy Daniela Arias Pardo ([@estparcae](https://github.com/estparcae))
- Manuel Torres ([@amunm9](https://github.com/amunm9))

**WOKI funciona cuando internet no funciona.**
