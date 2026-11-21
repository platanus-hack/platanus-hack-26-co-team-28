// woki-bridge/setup-webhook.ts   uso: npx tsx --env-file=.env setup-webhook.ts <url-del-túnel> [sessionId]
import { WapiClient } from "./wapi-sdk/index.ts";

const [tunnel, sid] = process.argv.slice(2);
if (!/^https?:\/\//.test(tunnel ?? "")) throw new Error("Pasa la URL del túnel (o http://localhost:8787 si wapi corre en este Mac)");
const sessionId = Number(sid ?? process.env.WAPI_SESSION_ID);
const account = new WapiClient({ apiKey: process.env.WAPI_PAT!, baseUrl: process.env.WAPI_BASE_URL });

const s = await account.sessions.update(sessionId, {
  webhook_url: `${tunnel.replace(/\/$/, "")}/webhook/wapi`,
  webhook_enabled: true,
  webhook_events: ["messages.received", "message.sent", "session.status"], // recibidos, enviados (historial) y conexión
  account_protection: true,   // 1 envío cada 5 s desde wapi
  ignore_groups: false,       // grupos llegan solo para detectar menciones; el puente descarta el resto
});
console.log(`Webhook de la sesión ${s.id} → ${s.webhook_url}`);
