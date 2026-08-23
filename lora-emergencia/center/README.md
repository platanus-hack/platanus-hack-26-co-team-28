# Command Center

Centro de operaciones offline para la red de emergencia LoRa. Esta carpeta contiene el prototipo existente (`center.py`) y las definiciones que guiarán su evolución hacia una aplicación operativa para Raspberry Pi.

## Objetivo

Permitir que un operador reciba y gestione reportes, visualice recursos en un mapa offline, asigne recursos a zonas o incidentes y envíe comunicaciones masivas a los nodos LoRa.

## Arquitectura acordada

```text
Celular del recurso o civil
        │ WiFi local
Nodo TTGO LoRa32
        │ LoRa 915 MHz
TTGO gateway activo ─── TTGO gateway de respaldo
        │ USB serial
Raspberry Pi
        ├── recepción y transmisión de radio
        ├── aplicación y reglas operativas
        ├── SQLite
        ├── cartografía offline
        └── dashboard web local
```

La Raspberry Pi contiene el command center. El TTGO central funciona como gateway especializado y no aloja el dashboard.

## Stack propuesto

| Capa | Elección | Motivo |
|---|---|---|
| Radio y backend | Python stdlib + pyserial opcional | Compatible con Python 3.9 y operación local sin servicios externos |
| Persistencia | SQLite | Archivo local, sin servidor externo y apto para operación offline |
| Interfaz | HTML, CSS y JavaScript vanilla | SPA local sin compilación, CDN ni conexión a internet |
| Mapa | Esquema local de coordenadas | Ubicaciones observadas sin introducir aún zonas formales ni cartografía remota |
| Despliegue | Raspberry Pi | Ejecuta aplicación, almacenamiento y servidor web local |

El servidor expone la API versionada bajo `/api/v1` y mantiene temporalmente los endpoints legacy del prototipo.

## Capacidades previstas

- Recibir, validar, deduplicar y conservar reportes.
- Mostrar reportes por prioridad, tipo, ubicación y antigüedad.
- Registrar recursos y vincularlos temporalmente con nodos TTGO.
- Asignar recursos a zonas e incidentes.
- Mostrar posiciones puntuales obtenidas desde el GPS del celular.
- Enviar broadcasts globales, por zona o por nodos seleccionados.
- Separar ACK de radio de confirmación humana.
- Detectar gateways o nodos sin comunicación.
- Proponer asignaciones mediante agentes con autorización humana.
- Mantener un historial auditable de decisiones y transmisiones.

## Documentos

- [`DESIGN.md`](DESIGN.md): sistema visual y composición de pantallas.
- [`PRODUCT.md`](PRODUCT.md): alcance, entidades y reglas operativas.
- [`ARCHITECTURE.md`](ARCHITECTURE.md): módulos y seams del sistema.
- [`PROTOCOL.md`](PROTOCOL.md): borrador de mensajes y garantías de entrega.
- [`TOOLCHAIN.md`](TOOLCHAIN.md): instalación, compilación, flasheo y técnicas no bloqueantes.
- [`CENTRO.md`](CENTRO.md): guía operativa del flujo Raspberry ↔ gateway ↔ recursos.

## Estado actual

`center.py` funciona como gateway y bootstrap HTTP; `command_core.py` conserva dominio y SQLite, `api.py` expone contratos versionados y `web/` contiene el dashboard offline. El mapa actual es un esquema de coordenadas; la cartografía local sigue pendiente.

La posición del puesto de mando no se presume: el TTGO central no incluye GPS. Para mostrar una ubicación fija configurada en el esquema:

```bash
python3 center.py /dev/ttyUSB0 --port 8081 --center-lat 4.6767 --center-lon -74.0483
```

La interfaz la identifica como `CONFIGURADA`, distinta de una posición observada por GPS. Si el centro se desplaza, debe actualizarse manualmente o integrarse un módulo GPS externo.

## Simular triage sin hardware

```bash
cd lora-emergencia/center
python3 center.py --demo
```

Abre `http://localhost:8080`. El demo carga solicitudes y recursos sintéticos, escala señales críticas sin reducir la prioridad reportada y recomienda el recurso compatible disponible más cercano. Toda asignación sigue requiriendo confirmación humana.

Por defecto el servidor escucha únicamente en `127.0.0.1`. Para operar en una LAN se exige un token Bearer:

```bash
python3 center.py /dev/ttyUSB0 --host 0.0.0.0 --api-token 'token-largo-y-aleatorio'
```

Ingresa el mismo token con el botón **Token API** del dashboard. Se conserva solo en `sessionStorage` durante la pestaña actual. En modo autenticado el frontend usa polling autenticado porque `EventSource` nativo no permite enviar el header `Authorization`.

Para ejecutar las pruebas:

```bash
python3 -m unittest -v
```
