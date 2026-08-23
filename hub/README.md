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
- `ELEVENLABS_API_KEY`: clave privada para narrar los pasos.
- `ELEVENLABS_VOICE_ID`: voz elegida en ElevenLabs para la guía en español.

## Contratos

- `POST /api/sync`: ingesta autenticada por Bearer y confirmación por `event_id`.
- `GET /api/health`: indica si el runtime está configurado.
- `/`: acceso referencial sin autenticación; redirige al onboarding.
- `/setup`: onboarding visual de nueve pasos; inicia en simulación, explica la topología, embebe el visor 3D, no modifica dispositivos y permite copiar la guía para ChatGPT o Claude.
- `/command-center`: overview de la réplica online, con mapa y refresco cada 15 segundos.
- `/command-center/requests`: cola sincronizada de solicitudes con filtros.
- `/command-center/resources`: disponibilidad, señal y última conexión de los nodos.
- `/command-center/network`: trazabilidad de eventos entre la operación local y la réplica.
- `/command-center/broadcasts`: seguimiento de broadcasts y confirmaciones; su envío sigue siendo local.
- `/command-center/safe-people`: registros anonimizados y coordenadas aproximadas.
- `GET /api/onboarding/voice?step=...`: narración española con Eleven Multilingual v2.

El onboarding no forma parte del menú operacional. Desde `Configuración` se puede volver a abrir
desde el paso 1 cuando sea necesario preparar otro kit. Su encabezado permite copiar un prompt
autocontenido para que ChatGPT o Claude acompañen tanto a una persona técnica como no técnica. El
paso `Reconoce el kit` agrega otro prompt específico para comparar stock, compatibilidad, tiendas
cercanas y costo total en la moneda local, sin incluir productos agotados.

El endpoint acepta reintentos. Supabase aplica idempotencia mediante
`woki_ingest_event`; una confirmación duplicada sigue siendo válida para vaciar la outbox local.
El Centro redondea las posiciones antes de enviarlas y omite nombre/documento de personas a salvo.

La clave de ElevenLabs solo existe en el servidor. Los audios determinísticos por paso se cachean
para no consumir créditos cada vez que un operador repite una instrucción. Si el proveedor no está
configurado, la voz usa el sintetizador español del dispositivo.

El mapa online descarga mosaicos de OpenStreetMap porque el Hub sí dispone de internet. La
cartografía offline permanece en la laptop local y no se sube a Supabase.
