# Arquitectura propuesta

## Principio

El command center oculta la complejidad de radio detrás de una interfaz operacional pequeña. El dashboard no conoce puertos seriales, reintentos ni payloads; expresa intenciones como recibir un reporte, asignar un recurso o transmitir un broadcast.

## Módulos

### Radio

Responsable de comunicación serial, codificación, deduplicación técnica, ACK, reintentos y estado de gateways.

Interfaz conceptual:

- Recibir eventos de campo.
- Transmitir una orden a un conjunto de destinatarios.
- Consultar el resultado de una transmisión.
- Observar el estado del gateway.

### Operaciones

Responsable del ciclo de vida de reportes, recursos, zonas y asignaciones. Aplica reglas y genera un historial auditable.

### Ubicación

Recibe observaciones de distintas fuentes, conserva precisión y antigüedad y determina su calidad. No decide asignaciones.

### Broadcast

Construye destinatarios, controla expiración, solicita transmisión y consolida confirmaciones técnicas y humanas.

### Recomendaciones

Produce propuestas explicables usando estado operacional. No ejecuta acciones que requieran autorización.

### Cartografía

Sirve mapas locales y proyecta recursos, zonas, reportes y puntos de interés en capas independientes.

### Dashboard

Presenta el estado y captura intenciones del operador. No accede directamente al serial ni escribe la base de datos fuera de las interfaces de los módulos anteriores.

## Flujo de reporte

```text
Nodo → Gateway → Radio → validación/deduplicación → Operaciones
                                                   ├── Persistencia
                                                   ├── Dashboard
                                                   └── Recomendaciones
```

El ACK de radio se produce antes de cualquier procesamiento visual. Una caída del dashboard no debe impedir que el gateway confirme un paquete válido.

## Flujo de broadcast

```text
Operador o agente propone
          ↓
Validación de destinatarios y expiración
          ↓
Autorización humana
          ↓
Broadcast → Radio → Gateway → nodos
                            ← confirmaciones
          ↓
Seguimiento por destinatario
```

## Flujo de asignación agentic

```text
Reporte + recursos + zonas + posiciones
                  ↓
          recomendación explicada
                  ↓
       autorizar / modificar / rechazar
                  ↓
          asignación persistida
                  ↓
            orden al nodo
```

## Persistencia

SQLite conserva como mínimo:

- Mensajes de radio originales.
- Reportes y transición de estados.
- Recursos y nodos.
- Vinculaciones recurso–nodo.
- Zonas.
- Asignaciones.
- Observaciones de ubicación.
- Broadcasts y resultados por destinatario.
- Recomendaciones y autorizaciones.
- Salud de gateways y nodos.

Los eventos originales no se sobrescriben. Las vistas actuales pueden derivarse o mantenerse junto al historial.

## Operación offline

- Dependencias frontend empaquetadas localmente.
- Fuentes e iconos locales o del sistema.
- Tiles y estilos cartográficos locales.
- Base de datos local.
- Sin autenticación dependiente de un proveedor externo.
- Inicio automático al arrancar la Raspberry Pi.
- Exportación y respaldo por archivo cuando exista un medio disponible.

## Dos gateways durante el demo

- Gateway A: activo.
- Gateway B: respaldo.

No transmiten simultáneamente uno junto al otro. El segundo permite recuperación rápida y valida el diseño con más de un adapter de radio. Un esquema RX/TX simultáneo se evaluará después con separación RF y pruebas de canal.

## Decisiones pendientes

- Formato binario o textual definitivo del protocolo.
- Ventanas de escucha de los nodos para downlink.
- Estrategia de confirmación sin tormenta de ACK.
- Identidad y autenticación local de nodos y operadores.
- Área exacta y fuente licenciada de cartografía offline.
- Política de failover entre gateways.
- Límites de autonomía de los agentes.
