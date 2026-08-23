# Centro local y Hub online

## Objetivo

Agregar visibilidad online sin debilitar la promesa principal: WOKI debe recibir, priorizar y coordinar emergencias aunque Vercel, Supabase o internet no estén disponibles.

## Responsabilidades

### Centro local — implementado

- Autoridad operacional durante la emergencia.
- Radio, reglas, SQLite, mapa y dashboard local.
- Acepta acciones críticas del operador.
- Conserva el historial operacional.

### Hub online — implementado

- Dashboard público de solo lectura desplegado en <https://woki-hub.vercel.app>.
- Replica eventos en las tablas `woki_operations`, `woki_origins` y `woki_events` de Supabase Postgres.
- Permite monitoreo remoto y demostración sin hardware.
- Puede generar Recomendaciones, nunca ejecutar directamente una Asignación en la primera versión.

### Sincronizador — implementado

- Corre junto al Centro local.
- Guarda una salida durable en la misma transacción que el cambio local.
- Cuando detecta internet, envía lotes pequeños con reintentos y backoff.
- Supabase acepta cada evento de forma idempotente.
- Un evento solo se marca sincronizado después de una confirmación remota.

El Centro ya implementa `sync_outbox`, identidad estable, secuencia monotónica, reintentos con
backoff y el worker HTTPS. Se activa solo cuando existen `WOKI_SYNC_URL` y
`WOKI_SYNC_TOKEN`; sin esas variables el Centro arranca y opera normalmente offline.

## Flujo

```text
Radio → Centro local → SQLite + salida pendiente
                            │
                    internet disponible
                            ▼
                    endpoint de ingesta
                            ▼
                 Supabase → Hub en Vercel
```

La desconexión aumenta la cola pendiente; no cambia la interfaz operacional ni bloquea al operador.

## Contrato mínimo de un evento sincronizable

```text
event_id       identificador global e inmutable
operation_id   operación o despliegue al que pertenece
origin_id      Centro local que lo produjo
sequence       orden monotónico dentro del origen
kind           tipo de hecho operacional
occurred_at    hora registrada por el origen
payload        datos mínimos del hecho
schema_version versión para evolución compatible
```

El endpoint remoto debe aceptar el mismo `event_id` varias veces y producir un solo resultado.

## Autoridad y conflictos

Primera versión:

- Los Eventos operacionales se originan en el Centro local.
- El Hub online es de consulta.
- Una propuesta remota vuelve como Recomendación y requiere Autorización local.
- No se usa “última escritura gana” para estados de incidentes.

Esto evita resolver conflictos críticos durante la hackathon. La edición operacional multi-centro queda fuera de alcance.

## Datos y privacidad

- La demo online usa datos sintéticos.
- Documentos de personas a salvo, coordenadas exactas y texto sensible no se hacen públicos.
- Las tablas expuestas en Supabase deben usar permisos mínimos y Row Level Security.
- La clave privilegiada de Supabase vive solo en servidor o en el sincronizador, nunca en el navegador.
- El dashboard público consume una vista anonimizada.

## Stack propuesto

- **Local:** Python, SQLite y el dashboard existente.
- **Ingesta y dashboard online:** Vercel.
- **Réplica:** Supabase Postgres.
- **Actualización visual:** Supabase Realtime después de persistir; no se usa Realtime como garantía de entrega.

## Proyecto Supabase

El proyecto `ContactoLetreros` fue renombrado a `WOKI` y reactivado. Sus tablas heredadas se
conservaron sin cambios. El esquema WOKI usa el prefijo `woki_`, tiene RLS activa y niega acceso
a `anon` y `authenticated`; la función idempotente `woki_ingest_event` solo puede ejecutarla
`service_role`. La definición versionada está en
[`../supabase/migrations/202608230001_create_woki_replica.sql`](../supabase/migrations/202608230001_create_woki_replica.sql).

El token personal de administración no forma parte del runtime. El Centro hablará con un
endpoint de Vercel autenticado mediante un secreto independiente y rotatable; solo ese endpoint
accederá a Supabase con credenciales de servidor.

## Demo para el concurso

1. Desconectar internet visiblemente.
2. Crear y resolver una emergencia mediante LoRa y el Centro local.
3. Mostrar la cola de sincronización pendiente.
4. Restaurar internet.
5. Ver la misma operación aparecer automáticamente en el Hub online.

La URL del Hub online será el `deploy-url` de la entrega. El visor 3D queda como evidencia complementaria.

## Estado del incremento

1. **Implementado:** tabla local `sync_outbox`, identidad, secuencia y estado de sincronización.
2. **Implementado:** Eventos de la línea de vida de una emergencia, minimizados y escritos en la misma transacción local.
3. **Implementado:** worker HTTPS por lotes que exige confirmación explícita por `event_id`.
4. **Implementado:** tablas WOKI, RLS y función idempotente en Supabase.
5. **Implementado:** endpoint autenticado de ingesta en Vercel.
6. **Implementado:** Hub online de solo lectura y estado de réplica.
7. **Implementado:** indicador `Offline · N pendientes · Sincronizado` en el dashboard local.

## Referencias de implementación

- [Supabase para Vercel](https://vercel.com/marketplace/supabase)
- [Seguridad de la Data API](https://supabase.com/docs/guides/api/securing-your-api)
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Cambios en tiempo real](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes)
