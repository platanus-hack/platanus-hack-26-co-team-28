// woki-bridge/credenciales.ts
// Sin argumentos: lista tus sesiones. Con un id: guarda sus claves en .env (sin mostrarlas).
import { readFileSync, writeFileSync } from "node:fs";
import { WapiClient } from "./wapi-sdk/index.ts";

const account = new WapiClient({ apiKey: process.env.WAPI_PAT!, baseUrl: process.env.WAPI_BASE_URL });
const id = process.argv[2];

if (!id) {
  const list = await account.sessions.list();
  if (!list.length) console.log("Tu cuenta no tiene sesiones todavía. Es normal: sigue con el sandbox.");
  else console.table(list.map((s) => ({ id: s.id, nombre: s.name, numero: s.phone_number, estado: s.status })));
  process.exit(0);
}

const s = await account.sessions.get(Number(id));
if (!s.api_key) throw new Error("La sesión no devolvió su key. Cópiala a mano desde su página en el dashboard.");
const set = (env: string, k: string, v: string) => {
  const re = new RegExp(`^${k}=.*$`, "m");
  return re.test(env) ? env.replace(re, () => `${k}=${v}`) : `${env.trimEnd()}\n${k}=${v}\n`;
};
let env = readFileSync(".env", "utf8");
env = set(env, "WAPI_SESSION_ID", String(s.id));
env = set(env, "WAPI_API_KEY", s.api_key);
env = set(env, "WAPI_WEBHOOK_SECRET", s.webhook_secret ?? "");
writeFileSync(".env", env);
console.log(`Sesión ${s.id} (${s.name} · ${s.status}) guardada en .env`);
