# WOKI · Red de emergencia sin internet

Cuando un terremoto tumba la red celular, pedir ayuda deja de ser un problema de interfaz: se vuelve un problema de comunicación y coordinación. WOKI crea un camino local entre la persona afectada y el puesto de mando, sin depender de internet.

```text
Celular → WiFi del nodo → LoRa 915 MHz → Gateway → Centro local
```

La persona no instala una app. Se conecta al WiFi de un nodo TTGO, reporta qué necesita y aporta GPS o una descripción del lugar. El nodo transmite un paquete corto por LoRa, espera confirmación y reintenta si es necesario.

En la Raspberry Pi, el centro conserva todo en SQLite, prioriza incidentes, recomienda recursos compatibles y permite al operador autorizar el despacho. El recurso acepta la misión y reporta su avance hasta cerrar el incidente. La radio, la base de datos, el mapa y el dashboard funcionan localmente.

## Dos modos complementarios

- **Modo offline:** es el producto operacional y la fuente de verdad durante la emergencia.
- **Modo online:** es una réplica desplegada en Vercel con Supabase para visibilidad remota, consulta controlada y evaluación del proyecto.

Cuando vuelve internet, el centro local sincroniza automáticamente sus eventos pendientes. Si la nube falla, la operación continúa y la cola reintenta. El hub online no ejecuta acciones críticas: muestra información, mientras la autorización permanece en el centro local.

## Estado demostrado

- Comunicación LoRa y ACK entre placas TTGO documentada en hardware.
- Command center local, persistencia SQLite y dashboard offline implementados.
- Flujo lógico completo verificado automáticamente: SOS, triage, despacho, aceptación, trayecto y resolución.
- Portal, gateway, nodo recurso y validadores de hardware incluidos.
- Outbox SQLite, worker HTTPS, ingesta idempotente en Supabase y Hub online desplegados.

## Enlaces públicos

- **Entrega principal:** <https://woki-hub.vercel.app>
- **Configuración guiada:** <https://woki-hub.vercel.app/setup>
- **Centro Python en modo demo aislado:** <https://woki-command-center-demo.onrender.com>
- **Diseños listos para impresión 3D:** <https://woki-lora-enclosures.vercel.app>
- **Visualización del flujo LoRa:** <https://lora.uprizing.me>

La promesa central no cambia: **WOKI funciona cuando internet no funciona**.
