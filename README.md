# WOKI · Red de emergencia sin internet

> Pedir ayuda, priorizar incidentes y coordinar recursos cuando la red celular deja de funcionar.

WOKI conecta celulares, nodos TTGO LoRa32 y un centro de operaciones en Raspberry Pi. El civil no instala una app: entra al WiFi local del nodo, envía un reporte corto y LoRa lo transporta hasta el puesto de mando.

## El valor

- **Sigue operando sin internet:** radio, dashboard, mapa y SQLite viven localmente.
- **Cierra el ciclo:** reporte, ACK, prioridad, asignación, aceptación y resolución.
- **Recupera visibilidad sin bloquear:** una outbox durable ya espera y reintenta los eventos cuando vuelve la red.
- **Mantiene control humano:** una recomendación nunca ejecuta por sí sola una asignación crítica.

## Dos modos, una sola operación

```text
SIN INTERNET
Celular → WiFi del Nodo → LoRa → Gateway → Centro local (Raspberry + SQLite)
                                                    │
WORKER IMPLEMENTADO                                 │ sincronización automática
                                                    ▼
                                      Hub online (Supabase + Vercel)
```

El **Centro local** es la autoridad operacional. La outbox, el worker HTTPS, la ingesta idempotente en Supabase y el **Hub online** ya están implementados; la caída de la nube nunca detiene el flujo de emergencia.

## Qué funciona hoy

- Enlace LoRa 915 MHz y ACK entre placas TTGO.
- Portal WiFi local para reportar una emergencia sin instalar una app.
- Gateway USB y command center local con SQLite.
- Triage determinista, recomendación de recursos y autorización humana.
- Flujo `PENDIENTE → DESPACHADA → ACEPTADA → EN_CURSO → RESUELTA`.
- Personas a salvo, broadcasts, trazabilidad y estado de la red.
- Dashboard sin CDN y cartografía offline de Bogotá preparada previamente.
- Modo demo sin hardware y verificador end-to-end automatizado.
- Outbox SQLite durable, reintentos automáticos y réplica Supabase protegida con RLS.

## Probarlo sin hardware

```bash
cd lora-emergencia/center
python3 center.py --demo
```

Abre <http://localhost:8080>. En otra terminal:

```bash
cd lora-emergencia
python3 scripts/verificar_e2e.py
```

El Hub online de solo lectura está en <https://woki-hub.vercel.app>.

### Demo pública del centro de mando

El [`render.yaml`](render.yaml) publica una instancia interactiva separada del centro real. Render
la inicia con datos sintéticos, SQLite en memoria y un gateway simulado:

```bash
python3 center.py --demo --public-demo --host 0.0.0.0 --port "$PORT"
```

La demo no acepta radio, sincronización externa, credenciales ni descargas del mapa offline. Sus
visitantes comparten el estado mientras el proceso está activo y cualquier reinicio lo restaura;
no debe usarse para una operación real. El Hub de Vercel sigue siendo el producto online principal.

## Demo con radio real

Requiere dos LilyGO TTGO LoRa32 T3 V1.6.1 de 915 MHz, antenas y un computador o Raspberry Pi:

```bash
cd lora-emergencia
bash scripts/desplegar_nodo.sh /dev/cu.usbserial-NODO
bash scripts/desplegar_centro.sh /dev/cu.usbserial-GATEWAY
```

El portal HTTPS necesita un `nodo_portal_https/credentials.h` provisionado localmente; la clave privada no se versiona. Nunca energices una placa sin antena.

## Evidencia

- Más de 100 pruebas automatizadas del centro.
- Verificador del flujo lógico con 20 comprobaciones end-to-end.
- Validadores separados para el portal cautivo y el loop físico LoRa.
- [Prototipo público de módulos físicos](https://woki-lora-enclosures.vercel.app).

## Documentación

Empieza por [la guía de documentación](docs/README.md). Ahí se separa lo implementado, el guion del demo, la arquitectura local-first y la investigación futura.

## Estado de entrega

El nombre, descripción, logo y Hub online están publicados. `platanus-hack-project.jsonc` apunta al producto principal; el visor 3D queda como evidencia complementaria.

## Equipo

- Juan Ortega ([@juanortega10](https://github.com/juanortega10))
- Nicolas Vargas ([@MrUprizing](https://github.com/MrUprizing))
- Jhomar Astuyauri Herencia ([@asther0](https://github.com/asther0))
- Emmy Daniela Arias Pardo ([@estparcae](https://github.com/estparcae))
- Manuel Torres ([@amunm9](https://github.com/amunm9))
