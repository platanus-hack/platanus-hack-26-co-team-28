# WOKI Hub

Réplica online de solo lectura para los eventos producidos por el Centro local.

## Ejecutar

```bash
bun install
bunx vercel link
bunx vercel env pull .env.local --environment=development --yes
# Añade SUPABASE_SERVICE_ROLE_KEY a .env.local desde Supabase > API Keys.
bun run dev
```

Variables requeridas:

- `SUPABASE_URL`: URL del proyecto WOKI.
- `SUPABASE_SERVICE_ROLE_KEY`: clave privada de servidor; nunca llega al navegador.
- `WOKI_SYNC_TOKEN`: secreto independiente compartido con el Centro local.
- `ANTHROPIC_API_KEY`: clave privada para la explicación contextual del onboarding.
- `ANTHROPIC_MODEL`: modelo de Anthropic; por defecto `claude-sonnet-5`.
- `ELEVENLABS_API_KEY`: clave privada para narrar los pasos.
- `ELEVENLABS_VOICE_ID`: voz elegida en ElevenLabs para la guía en español.

## Contratos

- `POST /api/sync`: ingesta autenticada por Bearer y confirmación por `event_id`.
- `GET /api/health`: indica si el runtime está configurado.
- `/`: visualización pública de payloads ya minimizados en el Centro.
- `/setup`: onboarding visual; inicia en simulación y no modifica dispositivos.
- `GET /api/onboarding/assist?step=...`: explicación breve de Anthropic, limitada al contexto del paso.
- `GET /api/onboarding/voice?step=...`: narración española con Eleven Multilingual v2.

El endpoint acepta reintentos. Supabase aplica idempotencia mediante
`woki_ingest_event`; una confirmación duplicada sigue siendo válida para vaciar la outbox local.

Las claves de IA solo existen en el servidor. Las respuestas y audios determinísticos por paso
se cachean para no consumir créditos cada vez que un operador repite una instrucción. Si los
proveedores no están configurados, el recorrido continúa: la voz usa el sintetizador español del
dispositivo y las instrucciones/documentación permanecen disponibles.
