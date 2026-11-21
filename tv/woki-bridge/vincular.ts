// woki-bridge/vincular.ts   uso: npx tsx --env-file=.env vincular.ts +569XXXXXXXX
// Crea (o reutiliza) la sesión del celular, muestra el QR en la terminal y, al vincular,
// guarda su key, id y secreto en .env sin mostrarlos.
import { readFileSync, writeFileSync } from "node:fs";
import qrcode from "qrcode-terminal";
import QR from "qrcode";
import { execFile } from "node:child_process";
import { WapiClient } from "./wapi-sdk/index.ts";

const phone = process.argv[2];
if (!phone?.startsWith("+")) throw new Error("Pasa el número del celular con +, por ejemplo: vincular.ts +569XXXXXXXX");
const digits = (s: string) => s.replace(/\D/g, "");
const account = new WapiClient({ apiKey: process.env.WAPI_PAT!, baseUrl: process.env.WAPI_BASE_URL });

const existing = (await account.sessions.list()).find((s) => digits(s.phone_number) === digits(phone));
const session = existing ?? (await account.sessions.create({
  name: "woki-demo", phone_number: phone,
  account_protection: true,   // 1 envío cada 5 s
  log_messages: false,        // wapi no guarda el texto de los mensajes
  ignore_groups: false,       // para avisar menciones en grupos (el puente descarta el resto)
}));
console.log(`Sesión ${session.id} (${existing ? "ya existía" : "creada"})`);

// El QR también se dibuja en qr.html (se recarga sola cada 3 s), porque la terminal de
// Claude Code colapsa la salida larga y el QR queda ilegible.
const page = (body: string) => writeFileSync("qr.html",
  `<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="3"><title>Vincular WOKI</title>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#fff;font:18px system-ui;color:#111;text-align:center">
<div>${body}</div></body>`);
page("<p>Pidiendo el QR a wapi…</p>");
execFile("open", ["qr.html"]);
let lastQr = "";
const show = async (qr?: string | null) => {
  if (!qr || qr === lastQr) return;
  lastQr = qr;
  const svg = await QR.toString(qr, { type: "svg", margin: 2, width: 420 });
  page(`<p><b>WhatsApp → Ajustes → Dispositivos vinculados → Vincular un dispositivo</b></p>${svg}<p style="color:#666">Se actualiza sola. El QR cambia cada ~20 s.</p>`);
  console.clear();
  console.log("En el celular: WhatsApp → Ajustes → Dispositivos vinculados → Vincular un dispositivo\n");
  qrcode.generate(qr, { small: true });
  console.log("\nEl QR cambia cada ~20 s; esta pantalla se actualiza sola.");
};

const conn = await account.sessions.connection.connect(session.id);
await show(conn.qrCode);
let status = conn.status.toLowerCase();
const deadline = Date.now() + 180_000;
while (status !== "connected" && Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 2_000));
  status = (await account.sessions.get(session.id)).status.toLowerCase();
  if (status !== "connected") await show((await account.sessions.connection.qrCode(session.id).catch(() => null))?.qrCode);
}
if (status !== "connected") { page("<p>No se vinculó a tiempo. Corre el script otra vez.</p>"); throw new Error(`La sesión sigue en "${status}" después de 3 min. Corre el script otra vez.`); }

const s = await account.sessions.get(session.id);
if (!s.api_key) throw new Error("La sesión no devolvió su key.");
const set = (env: string, k: string, v: string) => {
  const re = new RegExp(`^${k}=.*$`, "m");
  return re.test(env) ? env.replace(re, () => `${k}=${v}`) : `${env.trimEnd()}\n${k}=${v}\n`;
};
let env = readFileSync(".env", "utf8");
env = set(env, "WAPI_SESSION_ID", String(s.id));
env = set(env, "WAPI_API_KEY", s.api_key);
env = set(env, "WAPI_WEBHOOK_SECRET", s.webhook_secret ?? "");
writeFileSync(".env", env);
console.clear();
page("<h1>✓ Celular vinculado</h1><p>Ya puedes cerrar esta pestaña.</p>");
console.log(`✓ Celular vinculado · sesión ${s.id} · claves guardadas en .env`);
