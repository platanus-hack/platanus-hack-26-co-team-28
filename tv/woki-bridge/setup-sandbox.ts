// woki-bridge/setup-sandbox.ts
import { writeFileSync } from "node:fs";
import { WapiClient } from "./wapi-sdk/index.ts";

const account = new WapiClient({ apiKey: process.env.WAPI_PAT!, baseUrl: process.env.WAPI_BASE_URL });
const s = await account.sandbox.createSession("woki-sandbox");
const sb = new WapiClient({ apiKey: s.api_key!, baseUrl: process.env.WAPI_BASE_URL });
await account.sessions.connection.connect(s.id);               // igual que una sesión real: conectar…
await sb.sandbox.scan().catch(() => {});                       // …y "escanear" el QR falso
for (let i = 0; i < 40 && (await sb.status().catch(() => "")) !== "connected"; i++)
  await new Promise((r) => setTimeout(r, 250));

const dir = await sb.contacts.list();                          // directorio de prueba (números +999…)
const pick = (i: number) => { const c: any = dir[i] ?? dir[0]; return "+" + String(c.jid ?? c.id).split("@")[0]; };
writeFileSync("profile.sandbox.json", JSON.stringify({ contacts: [
  { id: "sofia",  name: "Sofía",  relation: "hija",      phone: pick(0), tone: "cariñosa y bromista" },
  { id: "camila", name: "Camila", relation: "cuidadora", phone: pick(1), tone: "cordial" },
] }, null, 2));

writeFileSync(".env.sandbox",
  `WA_MODE=sandbox\nPROFILE=profile.sandbox.json\nWAPI_API_KEY=${s.api_key}\nWAPI_WEBHOOK_SECRET=${s.webhook_secret ?? ""}\nWAPI_SANDBOX_SESSION_ID=${s.id}\n`);
console.log(`Sandbox listo · sesión ${s.id} · ${dir.length} contactos de prueba · claves guardadas en .env.sandbox`);
