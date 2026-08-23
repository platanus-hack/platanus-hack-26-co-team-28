# Guía de documentación

La documentación está ordenada por la pregunta que responde. El principio transversal es **local-first**: internet amplía WOKI, pero nunca habilita la operación básica.

## 1. Entender el valor

1. [`../README.md`](../README.md): propuesta, estado y forma de probar WOKI.
2. [`../project-description.md`](../project-description.md): relato corto para jurados.
3. [`../MISSION.md`](../MISSION.md): objetivo y prioridades.
4. [`../CONTEXT.md`](../CONTEXT.md): lenguaje del dominio.

## 2. Entender la arquitectura

1. [`ARQUITECTURA-CONEXIONES.md`](ARQUITECTURA-CONEXIONES.md): topología completa, conexiones eléctricas, módulos de software y diagramas editables.
2. [`ONLINE-SYNC.md`](ONLINE-SYNC.md): relación entre Centro local, Hub online y sincronización.
3. [`adr/0001-local-first-con-replica-online.md`](adr/0001-local-first-con-replica-online.md): decisión y trade-offs.
4. [`../lora-emergencia/center/ARCHITECTURE.md`](../lora-emergencia/center/ARCHITECTURE.md): módulos internos del command center.
5. [`../lora-emergencia/docs/PROTOCOLO-MINIMO.md`](../lora-emergencia/docs/PROTOCOLO-MINIMO.md): protocolo vigente del demo.

## 3. Ejecutar y demostrar

1. [`OPERAR-SINCRONIZACION.md`](OPERAR-SINCRONIZACION.md): guía para que Juan opere la laptop del Centro y valide offline → online.
2. [`../lora-emergencia/docs/PLAN-DEMO.md`](../lora-emergencia/docs/PLAN-DEMO.md): guion de tres minutos.
3. [`../lora-emergencia/center/README.md`](../lora-emergencia/center/README.md): ejecutar el centro.
4. [`../lora-emergencia/center/CENTRO.md`](../lora-emergencia/center/CENTRO.md): operación Raspberry ↔ gateway ↔ nodos.
5. [`../lora-emergencia/docs/PORTAL-CAUTIVO-E2E.md`](../lora-emergencia/docs/PORTAL-CAUTIVO-E2E.md): límites reales de portal y GPS.

## 4. Referencia e investigación

- `lora-emergencia/docs/PROTOCOL.md` documenta el protocolo inicial y es **legacy**.
- `lora-emergencia/docs/OSS-Y-PROTOCOLO.md` y `VOZ-Y-EDGE-A-LORA.md` son investigación, no capacidades implementadas.
- `lora-emergencia/diseno-3d/` contiene los módulos físicos y sus pendientes de validación dimensional.

## Regla editorial

Cada capacidad debe marcarse como una de estas:

- **Implementada:** existe en código y tiene verificación local.
- **Validada en hardware:** además existe evidencia con placas o teléfonos reales.
- **Definida:** existe una decisión o diseño, pero falta implementación.
- **Investigada:** se evaluó como alternativa; no forma parte del producto actual.

No usar “funciona” para una capacidad que solo está definida o investigada.
