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
| Mapa | Leaflet + VectorGrid local + Shortbread MBTiles | Calles offline de Bogotá; OSM raster online conserva autorización explícita por pestaña |
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
- [`MAP_DATA.md`](MAP_DATA.md): fuente, cobertura, licencia y atribución de la cartografía.

## Estado actual

`center.py` funciona como gateway y bootstrap HTTP; `command_core.py` conserva dominio y SQLite, `api.py` expone contratos versionados y `web/` contiene el dashboard offline. Leaflet 1.9.4 y Leaflet.VectorGrid 1.3.0 se empaquetan con sus licencias. Si existe el recorte Shortbread, el mapa lo usa automáticamente sin requests externos; si falta, mantiene el esquema local y ofrece una descarga explícita. La cartografía OSM raster online solo se activa con autorización por pestaña y divulga al proveedor el área visible. Al desactivarla vuelve al mapa vectorial local o, si no existe, al esquema.

`sync_worker.py` replica en segundo plano los eventos pendientes cuando existe conectividad. La
ausencia o caída del Hub no bloquea ninguna operación local. Para activarlo después de desplegar
el endpoint de Vercel:

```bash
export WOKI_SYNC_URL='https://TU-HUB.vercel.app/api/sync'
export WOKI_SYNC_TOKEN='secreto-independiente-del-centro'
python3 center.py /dev/ttyUSB0 --port 8081
```

No uses un token personal de Supabase como `WOKI_SYNC_TOKEN`.

## Preparar el mapa offline

La preparación descarga temporalmente cerca de 641 MB desde la URL fija de Geofabrik, valida el MBTiles, recorta Bogotá a z11–14 y elimina la fuente completa al finalizar. Requiere espacio libre adicional y nunca reemplaza un mapa válido hasta terminar correctamente:

```bash
cd lora-emergencia/center
python3 offline_map.py download
```

También puede iniciarse con **Descargar mapa offline de Bogotá** en el dashboard. `GET /api/v1/map` y `POST /api/v1/map/download` exigen el token Bearer configurado cuando la API está autenticada. El estado incluye una generación sin paths locales y el frontend la añade como `?v=` a la URL; así un reemplazo válido no reutiliza tiles inmutables del paquete anterior. Los tiles permanecen públicos y se sirven únicamente por `/map/tiles/{z}/{x}/{y}.pbf`.

La posición del puesto de mando no se presume: el TTGO central no incluye GPS. Para mostrar una ubicación fija configurada en el esquema:

```bash
python3 center.py /dev/ttyUSB0 --port 8081 --center-lat 4.6767 --center-lon -74.0483
```

La interfaz la identifica como `CONFIGURADA`, distinta de una posición observada por GPS. Si el centro se desplaza, debe actualizarse manualmente o integrarse un módulo GPS externo.

### Capturar la ubicación desde la pantalla del Raspberry

1. Abre el dashboard en Chromium usando `http://localhost:8081`.
2. En **Esquema de ubicaciones**, pulsa **Usar ubicación actual**.
3. Autoriza el permiso de ubicación y revisa coordenadas y precisión antes de confirmar.
4. La posición queda guardada en `center.db`; Internet puede desconectarse después.

`localhost` es importante porque el navegador permite geolocalización en ese contexto local. La Raspberry no incorpora GPS: Chromium puede resolver la ubicación mediante servicios de red cuando hay Internet, pero también puede responder que no está disponible. En ese caso usa **Ingresar coordenadas** o conecta el módulo GPS externo. El dashboard siempre muestra la fuente (`NAVEGADOR`, `MANUAL` o `CONFIGURADA`) y nunca presenta una coordenada configurada como GPS real.

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
