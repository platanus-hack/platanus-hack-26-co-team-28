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
| Radio y backend | Python + FastAPI + pyserial | Reutiliza el prototipo y simplifica la integración con USB serial |
| Persistencia | SQLite | Archivo local, sin servidor externo y apto para operación offline |
| Interfaz | React + TypeScript | Adecuado para mapa, estados en vivo, filtros y flujos operativos |
| Mapa | MapLibre con cartografía local | Capas de zonas, recursos, reportes y puntos operativos sin internet |
| Despliegue | Raspberry Pi | Ejecuta aplicación, almacenamiento y servidor web local |

El stack es una decisión de diseño inicial, no una implementación presente. Antes de construirlo deben cerrarse el protocolo LoRa y los flujos críticos.

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

`center.py` ya conserva el estado en SQLite, opera sin CDN, recibe frames universales y puede despachar o emitir broadcasts mediante el gateway. El mapa actual es un esquema de coordenadas; la cartografía local sigue pendiente.
