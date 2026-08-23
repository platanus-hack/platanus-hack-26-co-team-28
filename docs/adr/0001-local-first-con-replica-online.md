# ADR-0001 · Centro local como autoridad y Hub online como réplica

## Estado

Aceptada para la primera versión online.

## Contexto

WOKI existe para operar cuando internet falla, pero la entrega del concurso requiere una URL pública y los coordinadores se benefician de visibilidad remota cuando la conectividad regresa. Hacer que la nube sea la fuente de verdad invalidaría el valor principal; permitir escrituras críticas simultáneas en local y online introduciría conflictos difíciles de resolver durante una emergencia.

## Decisión

El Centro local conserva la autoridad operacional. Registra cambios como Eventos operacionales y los replica automáticamente al Hub online mediante una salida durable e idempotente.

En la primera versión, el Hub online es de consulta. Puede producir Recomendaciones, pero cualquier Asignación o acción crítica requiere Autorización en el Centro local.

## Consecuencias

- La operación continúa ante caídas de internet, Vercel o Supabase.
- La sincronización puede repetirse sin duplicar hechos.
- La URL pública demuestra el producto sin fingir que la nube es necesaria.
- El Hub puede mostrar información atrasada y debe indicar cuándo sincronizó por última vez.
- No existe edición operacional multi-centro en esta versión.
- Debemos minimizar y proteger los datos replicados, especialmente identidad y ubicación.

## Alternativas descartadas

- **Nube como autoridad:** rompe la operación offline.
- **Replicar tablas completas de SQLite:** acopla esquemas y hace ambiguos los conflictos.
- **Escrituras críticas en ambos lados con última escritura gana:** puede revertir decisiones humanas válidas.
