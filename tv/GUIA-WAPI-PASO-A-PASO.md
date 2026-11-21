# WOKI × wapi · Guía paso a paso desde cero

Esta guía no supone que conoces wapi ni el proyecto `wspbot`. Primero explica la herramienta, luego cómo conseguir acceso y después el armado, paso por paso. Cada paso tiene cuatro partes: **para qué sirve**, **qué hacer**, **qué deberías ver** y **si falla**.

Plan de fondo: `PLAN-WHATSAPP-WAPI.md`.

---

# Parte 1 · Entender la herramienta (15 min de lectura)

## 1.1 · Qué es wapi

**wapi es un servicio que te deja manejar un WhatsApp normal desde código.** Le das una orden por internet ("envía 'hola' a +569…") y el mensaje sale desde tu número, como si lo hubieras escrito en el celular.

Funciona igual que **WhatsApp Web**: tu celular vincula un "dispositivo" extra escaneando un QR. Solo que ese dispositivo no es un navegador, sino un servidor de wapi que queda conectado las 24 horas.

```
Tu celular ──(QR, dispositivo vinculado)──► servidor de wapi ◄──(HTTP)── tu código
     │                                           │
     └──── el número sigue funcionando normal ───┘
```

- Lo creó **Crafter Station** (Lima). Es open source: [github.com/crafter-station/wapi](https://github.com/crafter-station/wapi).
- Hay una instancia funcionando en **`https://wapi.crafter.run`** (dashboard) y **`https://api.wapi.crafter.run`** (API). Es la que usa `wspbot`.
- Documentación: [wapi.crafter.run/docs](https://wapi.crafter.run/docs) (guía) y [api.wapi.crafter.run/docs](https://api.wapi.crafter.run/docs) (referencia de cada endpoint).

**Por qué no la API oficial de Meta:** la oficial (WhatsApp Business Platform) es para empresas, exige verificación y plantillas aprobadas, y no sirve para escribirle a tu familia desde tu número personal. wapi sí, pero con un costo: **va contra los términos de WhatsApp.** Lo dice su propia documentación: el número puede quedar restringido o bloqueado, y recomiendan usar "un número que puedas permitirte perder".

## 1.2 · Qué es wspbot y por qué lo miramos

`Repositorios/wspbot` es un bot de WhatsApp para grupos, hecho por otra persona (Jibaru, de Crafter Station). **No lo vamos a usar ni a modificar.** Solo tomamos dos cosas que ya resolvió:

| Qué tomamos | Dónde está en wspbot | Para qué |
|---|---|---|
| El SDK de wapi (la librería para llamarlo desde TypeScript) | `lib/wapi-sdk/` | No tener que escribir las llamadas HTTP a mano |
| El ejemplo de cómo recibir mensajes de forma segura | `.agents/skills/wapi-nextjs/references/webhook-route.ts` | Copiar la verificación de la firma |
| Las lecciones que le costaron tiempo | `.agents/skills/wapi-nextjs/references/api-notes.md` | Evitar los mismos errores |

## 1.3 · Glosario (vas a ver estas palabras en todos los pasos)

| Palabra | Qué significa | Ejemplo |
|---|---|---|
| **Sesión** | Un número de WhatsApp conectado a wapi. Cada sesión tiene un id numérico | Sesión 12 = el celular del equipo |
| **Dashboard** | La web de wapi donde creas sesiones, ves el QR y copias claves | `wapi.crafter.run/sessions` |
| **Session key** (`WAPI_API_KEY`) | La clave de **una** sesión. Sirve para enviar mensajes y leer contactos. Empieza con `wapi_sk_` | Va en `.env`, nunca en el HTML |
| **PAT** (`WAPI_PAT`) | Personal Access Token: la clave de **tu cuenta**. Sirve para crear o configurar sesiones. Se muestra **una sola vez** | Página **Tokens** del dashboard |
| **Webhook** | Cuando llega un mensaje a tu número, wapi hace un POST a una URL tuya para avisarte. wapi **no** tiene otra forma de entregarte los mensajes entrantes | `https://xxxx.trycloudflare.com/webhook/wapi` |
| **Webhook secret** (`WAPI_WEBHOOK_SECRET`) | Clave para comprobar que el aviso viene de wapi y no de un tercero. Viaja en el header `X-Webhook-Signature` | — |
| **Túnel** | Da una URL pública a tu Mac para que wapi pueda alcanzarlo. Usamos `cloudflared` | `cloudflared tunnel --url http://localhost:8787` |
| **Sandbox** | Un número **falso** en un WhatsApp falso que ofrece wapi. Mismas rutas y mismos avisos que uno real. Sirve para probar sin arriesgar ningún número | Números que empiezan con `+999` |
| **JID** | Cómo WhatsApp identifica a alguien: `56912345678@s.whatsapp.net`. Un grupo termina en `@g.us` | — |
| **LID** | Un identificador nuevo de WhatsApp que **no** es el teléfono: `188025162178706@lid`. A veces el mensaje entrante trae el LID en vez del número | Por eso guardamos ambos |
| **msgId** | El número que wapi le asigna a cada mensaje que **envías**. Con él consultas si llegó o se leyó | `msgId: 4821` |
| **Account protection** | Opción de la sesión que obliga a esperar unos 5 s entre envíos, para parecer humano | Activarla siempre en números reales |

**La regla más importante:** session key y PAT van en el mismo header (`Authorization: Bearer …`) pero **no se intercambian**. Si usas la equivocada, wapi responde **403** (no 401). Es el error más común al empezar.

| Quiero… | Uso |
|---|---|
| Enviar un mensaje, leer contactos, ver si la sesión está conectada | Session key |
| Crear un sandbox, configurar el webhook, activar account protection, leer las claves de una sesión | PAT |

## 1.4 · Cómo encaja en WOKI

```
 TV · woki-os.html (navegador, localhost:8000)
   │ "envía esto a Sofía"          ▲ "Sofía escribió esto"
   ▼                               │
 woki-bridge · un programa Node en el Mac (localhost:8787)
   · guarda las claves (la TV nunca las ve)
   · solo deja escribir a Sofía y Camila (lista blanca)
   │ POST /api/send-message        ▲ webhook (por el túnel)
   ▼                               │
 wapi.crafter.run  ◄── QR ──►  celular del equipo  ◄──►  Sofía / Camila
```

**Por qué hace falta el puente (`woki-bridge`) y no se llama a wapi directo desde la TV:** la session key da control total del WhatsApp. Si estuviera en el HTML, cualquiera que abra la página podría escribirle a toda la agenda.

## 1.5 · Las 5 trampas que ya resolvió wspbot (y que el código de esta guía ya maneja)

1. **Un envío nunca se reintenta solo.** Si wapi tarda o da timeout, el mensaje igual pudo haber salido. Reintentar = mandarlo dos veces. Se consulta el estado con el `msgId`.
2. **Al webhook se le responde 200 al instante** y se procesa después. Si tardas, wapi lo reenvía (hasta 5 veces) y el mismo mensaje aparece repetido.
3. **Deduplicar los entrantes** por `key.id`, por la misma razón.
4. **El remitente puede venir como LID**, con el teléfono en `remoteJidAlt` o sin él. Se compara contra los dos.
5. **La firma se verifica sobre el texto crudo** del aviso, antes de leer el JSON.

---

# Parte 2 · Conseguir acceso a wapi (15–30 min, depende de otra persona)

## Paso A · Entrar al dashboard

**Para qué:** sin cuenta no hay claves.

**Qué hacer:**
1. Abre [wapi.crafter.run](https://wapi.crafter.run) y aprieta **Get started**. El login es con Clerk (el sistema de cuentas que usa wapi); te ofrecerá Google, email u otro método.
2. Si entras y ves la página **Sessions** vacía, tienes cuenta. Sigue al Paso B.
3. Si no te deja entrar o pide invitación: **la documentación no dice si es abierto, gratis o solo por invitación.** Escríbele a quien administra `wspbot` (Jibaru / Crafter Station) y pídele acceso a la instancia, o que te cree una cuenta. Pregúntale también si hay límites de uso.

**Plan B si no consigues acceso a tiempo:** wapi se puede instalar en tu propio servidor (`docker compose up`, con Postgres, Redis y almacenamiento de archivos). Para una hackathon es demasiado: mejor insistir con el acceso o quedarse con el envío simulado.

## Paso B · Crear un PAT (la clave de tu cuenta)

**Para qué:** con el PAT, los scripts de esta guía crean el sandbox, leen las claves de las sesiones y configuran el webhook sin que tengas que buscar cada cosa en el dashboard.

**Qué hacer:**
1. En el dashboard, abre **Tokens** (`wapi.crafter.run/tokens`).
2. Crea un token con un nombre que lo identifique, por ejemplo `woki-mac`.
3. **Cópialo en ese momento.** wapi guarda solo un hash: si lo pierdes, hay que crear otro.
4. Guárdalo de forma temporal en un lugar seguro. En el Paso 1 va al `.env`.

**Qué deberías ver:** un texto largo que aparece una sola vez.

**Si falla:** si no ves la página Tokens, tu cuenta no tiene permisos. Vuelve al Paso A, punto 3.

> No vincules el celular todavía. Primero se prueba todo con el sandbox (Parte 4). El celular real entra en la Parte 6.

---

# Parte 3 · Preparar el Mac (10 min)

## Paso 1 · Herramientas y carpeta del proyecto

**Para qué:** dejar armada la carpeta `woki-bridge` con el SDK de wapi adentro.

**Qué hacer** (en la Terminal):

```bash
# 1. Comprobar Node (tiene que ser 22 o más)
node -v

# 2. Instalar cloudflared (el túnel)
brew install cloudflared

# 3. Crear el proyecto junto al prototipo
cd ~/Documents/Repositorios/woki-ux-research
mkdir woki-bridge && cd woki-bridge
npm init -y
npm pkg set type=module
npm i -D tsx@4 typescript@5 @types/node@22

# 4. Copiar el SDK de wapi desde wspbot (solo se copia, wspbot no se toca)
cp -R ../../wspbot/lib/wapi-sdk ./wapi-sdk

# 5. Que los secretos nunca entren a git
printf '.env\n.env.*\nnode_modules\n' > .gitignore

# 6. Atajos para arrancar
npm pkg set scripts.dev="tsx watch --env-file=.env server.ts"
npm pkg set scripts.sandbox="tsx --env-file=.env --env-file=.env.sandbox server.ts"
```

`tsx` ejecuta TypeScript directamente, sin compilar. `--env-file=.env` carga las claves.

Crea el archivo `.env` (en `woki-bridge/`), pegando tu PAT:

```bash
WAPI_BASE_URL=https://api.wapi.crafter.run
WAPI_PAT=pega_aqui_tu_pat
WAPI_SESSION_ID=
WAPI_API_KEY=
WAPI_WEBHOOK_SECRET=
WA_MODE=dry
PROFILE=profile.json
ALLOWED_ORIGIN=http://localhost:8000
PORT=8787
```

| Variable | Qué hace |
|---|---|
| `WA_MODE` | `dry` = no envía nada, solo lo muestra en consola. `sandbox` = número falso. `live` = WhatsApp real. `off` = apagado |
| `PROFILE` | Qué archivo de contactos usar (real o de sandbox) |
| `ALLOWED_ORIGIN` | La dirección desde donde se abre el prototipo. El puente rechaza llamadas de cualquier otra |
| Las vacías | Se llenan solas en los pasos siguientes |

Crea `profile.json`, la **lista blanca**. Solo a estas personas se les puede escribir, y solo sus mensajes llegan a la TV. Los números reales se completan en la Parte 6:

```json
{ "contacts": [
  { "id": "sofia",  "name": "Sofía",  "relation": "hija",      "phone": "+569XXXXXXXX", "tone": "cariñosa y bromista" },
  { "id": "camila", "name": "Camila", "relation": "cuidadora", "phone": "+569XXXXXXXX", "tone": "cordial" }
]}
```

**Qué deberías ver:** `node -v` muestra `v22…` o más, y `ls wapi-sdk` muestra `index.ts  http.ts  errors.ts  resources  types.gen.ts`.

**Si falla:**
- `node -v` muestra 20 o menos: `brew install node@22`.
- `cp: ../../wspbot/lib/wapi-sdk: No such file`: estás en otra carpeta. Haz `pwd`; tiene que terminar en `woki-ux-research/woki-bridge`.

## Paso 2 · Comprobar que el PAT funciona

**Para qué:** confirmar el acceso antes de construir nada, y ver qué sesiones tiene tu cuenta.

Crea `credenciales.ts`. Con el id de una sesión, este script copia al `.env` su session key, su id y su secreto. Así no hay que buscarlos en el dashboard:

```ts
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
```

```bash
npx tsx --env-file=.env credenciales.ts
```

**Qué deberías ver:** una tabla con tus sesiones o el mensaje "Tu cuenta no tiene sesiones todavía".

**Si falla:**
- `403`: pegaste una session key en `WAPI_PAT`. El PAT sale de la página Tokens.
- `401`: el PAT está mal copiado o fue revocado. Crea otro.
- `fetch failed` o `ENOTFOUND`: no hay internet o `WAPI_BASE_URL` está mal escrito.

---

# Parte 4 · Construir y probar el puente sin riesgo (1 h)

## Paso 3 · El puente: `server.ts`

**Para qué:** es el centro de todo. Recibe órdenes de la TV, habla con wapi y le avisa a la TV cuando llega algo.

| Ruta del puente | Quién la llama | Qué hace |
|---|---|---|
| `POST /api/wa/send` | La TV | Envía un mensaje a un contacto de la lista |
| `POST /api/wa/react` | La TV | Pone ❤️, 😂 o 👍 en un mensaje recibido |
| `GET /api/wa/events` | La TV | Canal abierto (SSE) por donde el puente avisa "llegó un mensaje" o "fue leído" |
| `GET /api/wa/health` | Tú, antes de la demo | Modo actual, si la sesión está conectada y cuántos mensajes van hoy |
| `POST /webhook/wapi` | wapi | Aquí llegan los mensajes entrantes |

**Qué hacer:** crea `server.ts` con este contenido. No hace falta entender cada línea; los comentarios marcan las partes.

```ts
// woki-bridge/server.ts
import http from "node:http";
import { readFileSync } from "node:fs";
import { createHmac, timingSafeEqual } from "node:crypto";
import { WapiClient } from "./wapi-sdk/index.ts";

// ---------- configuración ----------
type Mode = "off" | "dry" | "sandbox" | "live";
const MODE = (process.env.WA_MODE ?? "dry") as Mode;
const PORT = Number(process.env.PORT ?? 8787);
const ORIGIN = process.env.ALLOWED_ORIGIN ?? "http://localhost:8000";
const SECRET = process.env.WAPI_WEBHOOK_SECRET ?? "";
const MAX_PER_DAY = 30;
const MIN_GAP_MS = 5_000;
const MAX_LEN = 500;

const needsWapi = MODE === "sandbox" || MODE === "live";
if (needsWapi && !process.env.WAPI_API_KEY) throw new Error("Falta WAPI_API_KEY en .env");
const wapi = needsWapi
  ? new WapiClient({ apiKey: process.env.WAPI_API_KEY!, baseUrl: process.env.WAPI_BASE_URL })
  : null;

// ---------- lista blanca ----------
type Contact = { id: string; name: string; relation: string; phone: string; tone: string; lid?: string };
const profileFile = process.env.PROFILE ?? "profile.json";
const { contacts } = JSON.parse(readFileSync(new URL(profileFile, import.meta.url), "utf8")) as { contacts: Contact[] };
const byId = new Map(contacts.map((c) => [c.id, c]));
const digits = (s: string) => s.replace(/\D/g, "");
const user = (jid?: string) => (jid ?? "").split("@")[0].split(":")[0];

async function resolveLids() {
  if (!wapi) return;
  for (const c of contacts) {
    try { c.lid = user(await wapi.contacts.lid.fromPhone(digits(c.phone))); }
    catch { console.warn(`[lid] sin LID para ${c.id} (no es grave: se reconoce por teléfono)`); }
  }
}

function findSender(key: { remoteJid?: string; remoteJidAlt?: string }) {
  const ids = [key.remoteJid, key.remoteJidAlt].filter(Boolean).map(user);
  return contacts.find((c) => ids.includes(digits(c.phone)) || (c.lid && ids.includes(c.lid)));
}

// ---------- SSE hacia la TV ----------
const tvs = new Set<http.ServerResponse>();
function emit(ev: Record<string, unknown>) {
  const line = `data: ${JSON.stringify(ev)}\n\n`;
  for (const r of tvs) r.write(line);
}

// ---------- límites ----------
const usedIdem = new Set<string>();
const seenInbound = new Set<string>();
let day = new Date().toDateString(), sentToday = 0, lastSendAt = 0;
function quotaOk() {
  const d = new Date().toDateString();
  if (d !== day) { day = d; sentToday = 0; }
  if (sentToday >= MAX_PER_DAY) return "Se alcanzó el tope de mensajes de hoy";
  if (Date.now() - lastSendAt < MIN_GAP_MS) return "Espera unos segundos entre mensajes";
  return null;
}

// Un envío nunca se reintenta: se consulta su estado (0 error · 1 pendiente · 2 enviado · 3 entregado · 4 leído)
function trackStatus(msgId: number, contactId: string) {
  let last = -1, tries = 0;
  const t = setInterval(async () => {
    if (++tries > 20 || !wapi) return clearInterval(t);
    try {
      const info = await wapi.messages.info(msgId);
      const s = Number(info.status);
      if (s !== last) { last = s; emit({ type: "status", msgId, contactId, status: s }); }
      if (s === 0 || s === 4) clearInterval(t);
    } catch { /* se reintenta la consulta, no el envío */ }
  }, 3_000);
}

// ---------- utilidades HTTP ----------
const readBody = (req: http.IncomingMessage) =>
  new Promise<string>((ok, ko) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => ok(b)); req.on("error", ko); });
function json(res: http.ServerResponse, code: number, body: unknown) {
  res.writeHead(code, { "Content-Type": "application/json", "Access-Control-Allow-Origin": ORIGIN });
  res.end(JSON.stringify(body));
}
const safeEqual = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };
const verify = (raw: string, sig?: string) =>
  !!SECRET && !!sig && (safeEqual(sig, SECRET) || safeEqual(sig, createHmac("sha256", SECRET).update(raw).digest("hex")));

// ---------- rutas ----------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://x");

  if (req.method === "OPTIONS") {
    res.writeHead(204, { "Access-Control-Allow-Origin": ORIGIN, "Access-Control-Allow-Methods": "GET,POST", "Access-Control-Allow-Headers": "Content-Type" });
    return res.end();
  }

  // TV → enviar
  if (req.method === "POST" && url.pathname === "/api/wa/send") {
    if (MODE === "off") return json(res, 503, { ok: false, reason: "WhatsApp apagado" });
    const { contactId, text, idemKey } = JSON.parse((await readBody(req)) || "{}");
    const c = byId.get(contactId);
    const body = String(text ?? "").trim();
    if (!c) return json(res, 403, { ok: false, reason: "Contacto fuera de la lista" });
    if (!body || body.length > MAX_LEN) return json(res, 400, { ok: false, reason: "Texto vacío o muy largo" });
    if (!idemKey || usedIdem.has(idemKey)) return json(res, 409, { ok: false, reason: "Este mensaje ya se envió" });
    const q = quotaOk(); if (q) return json(res, 429, { ok: false, reason: q });
    usedIdem.add(idemKey); lastSendAt = Date.now(); sentToday++;

    if (MODE === "dry") {
      console.log(`[dry] → ${c.name}: ${body}`);
      emit({ type: "status", msgId: -1, contactId, status: 2 });
      return json(res, 200, { ok: true, msgId: -1, dry: true });
    }
    try {
      const sent = await wapi!.messages.send({ to: "+" + digits(c.phone), text: body });
      console.log(`[send] ${c.name} msgId=${sent.msgId}`);
      trackStatus(sent.msgId, contactId);
      return json(res, 200, { ok: true, msgId: sent.msgId });
    } catch (e: any) {
      // Un error o timeout NO prueba que no llegó: no se reintenta solo.
      console.error("[send] error", e?.status, e?.message);
      return json(res, 502, { ok: false, reason: "wapi no confirmó el envío. Revisa el celular antes de reintentar" });
    }
  }

  // TV → reaccionar a un mensaje entrante
  if (req.method === "POST" && url.pathname === "/api/wa/react") {
    const { key, emoji } = JSON.parse((await readBody(req)) || "{}");
    if (!findSender(key ?? {})) return json(res, 403, { ok: false, reason: "Contacto fuera de la lista" });
    if (MODE === "dry") return json(res, 200, { ok: true, dry: true });
    try { await wapi!.messages.react(key, emoji); return json(res, 200, { ok: true }); }
    catch (e: any) { return json(res, 502, { ok: false, reason: e?.message }); }
  }

  // TV ← eventos
  if (req.method === "GET" && url.pathname === "/api/wa/events") {
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "Access-Control-Allow-Origin": ORIGIN });
    res.write(`data: ${JSON.stringify({ type: "hello", mode: MODE })}\n\n`);
    tvs.add(res); req.on("close", () => tvs.delete(res));
    return;
  }

  // Estado
  if (req.method === "GET" && url.pathname === "/api/wa/health") {
    let session: string = MODE;
    if (wapi) { try { session = await wapi.status(); } catch { session = "down"; } }
    return json(res, 200, { mode: MODE, session, sentToday, contacts: contacts.map((c) => c.id) });
  }

  // wapi → mensaje entrante (firmado)
  if (req.method === "POST" && url.pathname === "/webhook/wapi") {
    const raw = await readBody(req);
    if (!verify(raw, req.headers["x-webhook-signature"] as string | undefined)) { res.writeHead(401); return res.end(); }
    res.writeHead(200); res.end("ok"); // responder YA: wapi reintenta si tardamos
    setImmediate(() => handleEvent(raw));
    return;
  }

  res.writeHead(404); res.end();
});

function handleEvent(raw: string) {
  let ev: { event: string; data: any };
  try { ev = JSON.parse(raw); } catch { return; }
  if (process.env.DEBUG_WEBHOOK) console.log("[webhook]", raw.slice(0, 2000));

  if (ev.event === "session.status") return emit({ type: "session", status: ev.data?.status });
  if (ev.event !== "messages.received") return;

  const key = ev.data?.key ?? {};
  if (key.fromMe || String(key.remoteJid ?? "").endsWith("@g.us")) return;   // ni propios ni grupos
  if (key.id && seenInbound.has(key.id)) return;                              // reintento de wapi
  if (key.id) seenInbound.add(key.id);

  const c = findSender(key);
  if (!c) return;                                                             // fuera de la lista: ni se muestra ni se guarda
  const m = ev.data?.message ?? {};
  const text = m.conversation ?? m.extendedTextMessage?.text;
  if (!text) return;                                                          // por ahora solo texto
  console.log(`[in] ${c.name}: ${text}`);
  emit({ type: "incoming", contactId: c.id, name: c.name, relation: c.relation, tone: c.tone, text, key });
}

await resolveLids();
server.listen(PORT, () => console.log(`woki-bridge · modo ${MODE} · ${contacts.length} contactos · http://localhost:${PORT}`));
```

**Probar en modo `dry`** (no toca wapi, solo prueba las reglas):

```bash
# Terminal 1: arrancar el puente (déjala abierta)
npm run dev

# Terminal 2: hacer pruebas
curl -s localhost:8787/api/wa/health
curl -s -XPOST localhost:8787/api/wa/send -H 'Content-Type: application/json' \
  -d '{"contactId":"sofia","text":"hola","idemKey":"t1"}'
curl -s -XPOST localhost:8787/api/wa/send -H 'Content-Type: application/json' \
  -d '{"contactId":"sofia","text":"hola","idemKey":"t1"}'
curl -s -XPOST localhost:8787/api/wa/send -H 'Content-Type: application/json' \
  -d '{"contactId":"pepito","text":"hola","idemKey":"t2"}'
```

**Qué deberías ver:**

| Prueba | Respuesta | Qué demuestra |
|---|---|---|
| `health` | `{"mode":"dry","session":"dry","sentToday":0,…}` | El puente está vivo |
| Primer envío | `{"ok":true,"msgId":-1,"dry":true}` y en la Terminal 1 `[dry] → Sofía: hola` | Envía (de mentira) |
| Mismo `idemKey` | `"Este mensaje ya se envió"` | Un doble disparo del EMG no duplica el mensaje |
| `pepito` | `"Contacto fuera de la lista"` | Solo se escribe a la lista blanca |

Si mandas dos envíos válidos seguidos, el segundo dice "Espera unos segundos entre mensajes". Es a propósito.

**Si falla:**
- `EADDRINUSE`: el puerto 8787 está ocupado. Cambia `PORT` en `.env`.
- `Cannot find module './wapi-sdk/index.ts'`: el SDK no se copió (Paso 1, punto 4).
- `Unexpected token` al arrancar: se cortó parte del código al copiarlo. Vuelve a pegarlo entero.

## Paso 4 · Crear el número falso (sandbox)

**Para qué:** probar envíos y mensajes entrantes **de verdad contra wapi**, pero con un número inventado que no puede escribirle a nadie real. Sin riesgo de bloqueo.

**Qué hacer:** crea `setup-sandbox.ts`. Usa tu PAT para crear el sandbox, guarda sus claves en `.env.sandbox` sin mostrarlas en pantalla y arma `profile.sandbox.json` con dos contactos de prueba:

```ts
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
```

```bash
npx tsx --env-file=.env setup-sandbox.ts
```

`.env.sandbox` se carga **encima** de `.env` (`npm run sandbox` carga los dos). Así cambias de modo sin editar nada.

**Qué deberías ver:**
- En la terminal: `Sandbox listo · sesión 57 · 3 contactos de prueba · …` (los números varían).
- En el dashboard: una sesión nueva `woki-sandbox`, con una pestaña **Sandbox** que muestra los contactos inventados y la conversación.

**Si falla:**
- `403`: `WAPI_PAT` no es un PAT. Revisa el Paso B.
- `0 contactos de prueba`: espera 10 segundos (el sandbox "se vincula solo" después de unos segundos) y corre `credenciales.ts` para ver su estado. Si ya está `connected`, borra la sesión en el dashboard y repite.

## Paso 5 · Primer envío real contra el sandbox

**Para qué:** confirmar que el puente habla con wapi.

```bash
# Terminal 1 (detén con Ctrl+C el `npm run dev` anterior)
npm run sandbox

# Terminal 2
curl -s localhost:8787/api/wa/health
curl -s -XPOST localhost:8787/api/wa/send -H 'Content-Type: application/json' \
  -d '{"contactId":"sofia","text":"prueba sandbox","idemKey":"s1"}'
```

**Qué deberías ver:**
- `health` responde `"mode":"sandbox","session":"connected"`.
- El envío responde `{"ok":true,"msgId":<un número>}`.
- En la Terminal 1: `[send] Sofía msgId=…`.
- En la pestaña **Sandbox** del dashboard: el mensaje "prueba sandbox" en la conversación.

En el sandbox no hay pausa de 5 s entre envíos. En un número real sí la habrá.

**Si falla:**
- `session: "down"`: la session key de `.env.sandbox` no sirve. Repite el Paso 4.
- `wapi no confirmó el envío`: mira en la Terminal 1 el error que sigue a `[send] error`. Un `403` significa que se cargó el PAT en vez de la session key: revisa que corres `npm run sandbox` y no `npm run dev`.

---

# Parte 5 · Conectar la TV (1 h 30)

Todo en `prototipo/woki-os.html`. Los números de línea son aproximados: busca el texto citado.

## Paso 6 · Que la TV pueda enviar

**Para qué:** que la doble ceja en la pantalla **Mensajes** envíe de verdad en vez de mostrar "Enviado (simulado)".

**6.1 · Decirle a la TV dónde está el puente.** En `const CFG = {` (línea ~422), agrega una línea:

```js
  WA_URL: 'http://localhost:8787',   // woki-bridge
```

**6.2 · Guardar a quién se le escribe.** Justo debajo de la línea que empieza con `const S = {` (línea ~490), agrega:

```js
const WA = { contactId:'sofia', name:'Sofía', relation:'hija', text:'', idem:null, inKey:null, online:false };
function openAgent(contactId, name, relation, text){
  Object.assign(WA, { contactId, name, relation, text, idem: crypto.randomUUID() });
  $('#s-agent .ctx div:last-child').textContent = 'Responder a ' + name;
  $('#s-agent .step b').textContent = `${name} (${relation})`;
  $('#agentMsg').textContent = text;
  go('agent');
}
```

`idem` es una marca única por mensaje: si el sensor EMG dispara dos veces, el puente reconoce la marca repetida y no envía de nuevo.

**6.3 · Que la frase elegida quede lista para enviar.** Busca `case 'say':` (línea ~652) y reemplaza esa línea por:

```js
case 'say': { const c=S.cards[+arg]; speak(c.text,c.emo);
  WA.text = c.text+' '+EMO[c.emo].e; $('#agentMsg').textContent = WA.text; break; }
```

**6.4 · Envío real en la segunda ceja.** Busca `case 'agentSend':` (línea ~666). Reemplaza la línea que contiene `'Enviado a Sofía (simulado)'` por:

```js
if(S.agentPending && performance.now()-S.agentPending<3000){
  S.agentPending=0; sendBtn(false); waSend(); }
```

Y agrega esta función al final del script, antes de `</script>`:

```js
async function waSend(){
  if(!WA.idem) WA.idem = crypto.randomUUID();
  island('…',`Enviando a ${WA.name}…`,false,8000);
  try{
    const r = await fetch(CFG.WA_URL+'/api/wa/send',{ method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ contactId:WA.contactId, text: WA.text || $('#agentMsg').textContent, idemKey: WA.idem }) });
    const j = await r.json();
    if(j.ok){ island('✓', j.dry ? `Enviado a ${WA.name} (prueba)` : `Enviado a ${WA.name}`); WA.idem=null; go('home'); }
    else island('⚠️','No se envió: '+j.reason,true,4000);
  }catch(e){ island('⚠️','Sin conexión a WhatsApp · no se envió',true,4000); }
}
```

**Qué hacer para probar:**
1. Terminal 1: `npm run sandbox` (en `woki-bridge`).
2. El servidor del prototipo ya corre en el puerto 8000. Recarga `http://localhost:8000/woki-os.html`.
3. En la TV: Hablar → elige una frase → Mensajes → ceja → ceja (o los clics que la simulan).

**Qué deberías ver:** "Enviando a Sofía…" → "Enviado a Sofía". En la Terminal 1, `[send] Sofía msgId=…`. En la pestaña Sandbox del dashboard, el mensaje.

**Si falla:**
- "Sin conexión a WhatsApp": el puente no está corriendo, o abriste el prototipo desde otra dirección (por ejemplo `127.0.0.1` en vez de `localhost`). Abre la consola del navegador (Cmd+Opción+J): si dice **CORS**, ajusta `ALLOWED_ORIGIN` en `.env` a la dirección exacta y reinicia el puente.
- "No se envió: Espera unos segundos": pasaron menos de 5 s desde el envío anterior. Es la protección.

## Paso 7 · Abrir el túnel y registrar el webhook

**Para qué:** que wapi pueda avisarle a tu Mac cuando llega un mensaje. Tu Mac no tiene dirección pública; el túnel le presta una.

**7.1 · Abrir el túnel.** En una **Terminal 3** que se queda abierta todo el tiempo:

```bash
cloudflared tunnel --url http://localhost:8787
```

Busca en lo que imprime una línea con `https://algo-algo-algo.trycloudflare.com` y cópiala.

Comprueba que funciona: abre `https://…trycloudflare.com/api/wa/health` en el navegador. Tiene que mostrar el mismo JSON que `localhost:8787/api/wa/health`.

**7.2 · Decirle a wapi esa dirección.** Crea `setup-webhook.ts`. Además del webhook, activa account protection y le pide a wapi que ignore los grupos:

```ts
// woki-bridge/setup-webhook.ts   uso: npx tsx --env-file=.env setup-webhook.ts <url-del-túnel> [sessionId]
import { WapiClient } from "./wapi-sdk/index.ts";

const [tunnel, sid] = process.argv.slice(2);
if (!/^https?:\/\//.test(tunnel ?? "")) throw new Error("Pasa la URL del túnel (o http://localhost:8787 si wapi corre en este Mac)");
const sessionId = Number(sid ?? process.env.WAPI_SESSION_ID);
const account = new WapiClient({ apiKey: process.env.WAPI_PAT!, baseUrl: process.env.WAPI_BASE_URL });

const s = await account.sessions.update(sessionId, {
  webhook_url: `${tunnel.replace(/\/$/, "")}/webhook/wapi`,
  webhook_enabled: true,
  webhook_events: ["messages.received", "session.status"],
  account_protection: true,   // 1 envío cada 5 s desde wapi
  ignore_groups: true,        // WOKI no lee grupos
});
console.log(`Webhook de la sesión ${s.id} → ${s.webhook_url}`);
```

Para el sandbox (usa el id que guardó el Paso 4):

```bash
npx tsx --env-file=.env --env-file=.env.sandbox setup-webhook.ts \
  https://algo-algo-algo.trycloudflare.com \
  $(grep SANDBOX_SESSION_ID .env.sandbox | cut -d= -f2)
```

Se suscribe solo a `messages.received`: los mensajes que **otros** te envían. Hay otros eventos (`messages.upsert` incluye los tuyos, `messages.update` trae las confirmaciones de leído) pero no hacen falta.

**Qué deberías ver:** `Webhook de la sesión 57 → https://…/webhook/wapi`. En el dashboard, en **Settings** de la sesión sandbox, la misma URL.

**Si falla:**
- `Pasa la URL https del túnel`: falta la URL o la copiaste sin `https://`.
- `403`: corriste el script con la session key en `WAPI_PAT`.

> **Cada vez que reinicias `cloudflared` cambia la URL** y hay que repetir el 7.2. Deja esa terminal abierta durante toda la hackathon.

## Paso 8 · Simular que Sofía escribe

**Para qué:** probar todo el camino de entrada (wapi → túnel → puente) sin ningún celular.

**Forma 1, desde el dashboard:** abre la sesión sandbox → pestaña **Sandbox** → escribe "¿vienes el domingo?" como el primer contacto (el que quedó como Sofía en `profile.sandbox.json`).

**Forma 2, desde la terminal:** crea `fake-inbound.ts`:

```ts
// woki-bridge/fake-inbound.ts   uso: npx tsx --env-file=.env --env-file=.env.sandbox fake-inbound.ts "¿vienes el domingo?"
import { readFileSync } from "node:fs";
import { WapiClient } from "./wapi-sdk/index.ts";

const sb = new WapiClient({ apiKey: process.env.WAPI_API_KEY!, baseUrl: process.env.WAPI_BASE_URL });
const sofia = JSON.parse(readFileSync("profile.sandbox.json", "utf8")).contacts[0];
await sb.sandbox.inbound(process.argv[2] ?? "¿vienes el domingo?", sofia.phone.replace("+", ""));
console.log("Mensaje falso enviado desde", sofia.name);
```

**Qué hacer:**

```bash
# Terminal 1: reinicia el puente mostrando los avisos crudos
DEBUG_WEBHOOK=1 npm run sandbox

# Terminal 2
npx tsx --env-file=.env --env-file=.env.sandbox fake-inbound.ts "¿vienes el domingo?"
```

**Qué deberías ver** en la Terminal 1:

```
[webhook] {"event":"messages.received","sessionId":57,"data":{"key":{"id":"…","remoteJid":"…","fromMe":false},"message":{"conversation":"¿vienes el domingo?"},"pushName":"…"}}
[in] Sofía: ¿vienes el domingo?
```

**Revisa esto con calma, es lo único que no se pudo verificar sin cuenta:** el texto tiene que venir en `data.message.conversation` (o `data.message.extendedTextMessage.text`) y el remitente en `data.key.remoteJid` o `data.key.remoteJidAlt`. Eso dice la documentación de wapi. Si en tu `[webhook]` viene en otro lugar, ajusta la función `handleEvent` de `server.ts` antes de seguir.

**Si falla:**

| Ves | Significa | Haz |
|---|---|---|
| Nada en la Terminal 1 | El aviso no llegó | ¿Túnel abierto? ¿El 7.2 se hizo con la URL actual? |
| `[webhook]` no aparece pero cloudflared muestra `401` | La firma no coincide | `WAPI_WEBHOOK_SECRET` de `.env.sandbox` no es el de esa sesión. Repite el Paso 4 |
| `[webhook] …` pero no `[in] Sofía` | El remitente no coincide con la lista | Compara el `remoteJid` del aviso con el `phone` de Sofía en `profile.sandbox.json` y corrígelo |

## Paso 9 · Que la TV muestre el mensaje y deje responder

**Para qué:** el momento de la demo. Llega un mensaje, la TV salta a Hablar con las 4 frases, Marta elige y responde.

Agrega al final del script de `woki-os.html`:

```js
(function waListen(){
  if(!CFG.WA_URL) return;
  const es = new EventSource(CFG.WA_URL+'/api/wa/events');
  es.onopen  = ()=>{ WA.online=true;  renderStatus(); };
  es.onerror = ()=>{ WA.online=false; renderStatus(); };   // EventSource reconecta solo
  es.onmessage = (m)=>{ const ev=JSON.parse(m.data);
    if(ev.type==='incoming') waIncoming(ev);
    if(ev.type==='status' && ev.status===4) island('✓✓',`${WA.name} lo leyó`);
    if(ev.type==='status' && ev.status===0) island('⚠️','WhatsApp no pudo entregar el mensaje',true,4000);
    if(ev.type==='session' && ev.status!=='connected') island('⚠️','WhatsApp se desconectó',true,5000);
  };
})();

function waIncoming(ev){
  Object.assign(WA, { contactId:ev.contactId, name:ev.name, relation:ev.relation, inKey:ev.key, idem:crypto.randomUUID() });
  beep(880,120,.04);
  $('#s-talk .ctx label').textContent = ev.name+' dice';
  $('#s-talk .ctx .avatar').textContent = ev.name[0];
  $('#ctxIn').value = ev.text;
  island('💬',`${ev.name}: ${ev.text}`,false,6000);
  go('talk'); genSuggestions();
}
```

**Para responder:** cuando Marta elige una frase en Hablar, queda guardada en `WA.text` (Paso 6.3). Falta un camino de Hablar a Mensajes con esa frase: conecta un botón "Responder por WhatsApp", o el gesto que ya abre Mensajes, a:

```js
openAgent(WA.contactId, WA.name, WA.relation, WA.text)
```

**Qué deberías ver:** con el puente en sandbox, el túnel abierto y la TV recargada, corres `fake-inbound.ts`. La TV suena, muestra "Sofía: ¿vienes el domingo?", pasa sola a Hablar con "Sofía dice" y genera 4 frases. Eliges una → Mensajes → ceja, ceja → aparece en la pestaña Sandbox del dashboard.

**Si falla:** abre la consola del navegador. Si no ves la conexión a `/api/wa/events` en la pestaña Network, revisa que `CFG.WA_URL` esté bien escrito.

## Paso 10 · Tono por persona, reacciones y estado (40 min, opcional)

**10.1 · Frases según quién escribe.** En `genSuggestions()`, cambia el `body` del `fetch` para que mande también el contacto:

```js
body: JSON.stringify({ context: ctx, contactId: WA.contactId })
```

El servicio de sugerencias (`SUGGEST_URL`) usa `relation` y `tone` de ese contacto en el prompt de Claude. Así "¿vienes el domingo?" de Sofía da frases cariñosas y con chiste, y de Camila, cordiales.

**10.2 · Reaccionar al mensaje.** En la acción de la pantalla Reacciones, cuando hay un mensaje recibido activo:

```js
if(WA.inKey){ fetch(CFG.WA_URL+'/api/wa/react',{ method:'POST', headers:{'Content-Type':'application/json'},
  body: JSON.stringify({ key: WA.inKey, emoji: '❤️' }) }); island('❤️',`Reaccionaste al mensaje de ${WA.name}`); }
```

La reacción no lleva doble ceja: no tiene texto y se puede quitar.

**10.3 · Indicador de conexión.** En `renderStatus()`, agrega:

```js
const wa = WA.online ? '<span style="color:var(--green)">● WhatsApp</span>' : '<span style="color:var(--orange)">● WhatsApp sin conexión</span>';
```

---

# Parte 6 · Pasar al celular real (30 min)

## Paso 11 · Elegir el número

**Usa una SIM secundaria del equipo, no tu número personal.** wapi va contra los términos de WhatsApp y su propia documentación advierte que el número puede quedar bloqueado. Si el número es nuevo, que tenga WhatsApp funcionando y algo de uso normal antes de vincularlo.

## Paso 12 · Vincular el celular

**Qué hacer:**
1. En el dashboard → **Sessions** → crea una sesión con un nombre (por ejemplo `woki-demo`) y el número del celular.
2. Aprieta **Connect**. Aparece un QR que se renueva cada ~20 segundos.
3. En el celular: WhatsApp → **Ajustes** → **Dispositivos vinculados** → **Vincular un dispositivo** → escanea el QR.
4. Espera a que la sesión diga **connected** en el dashboard.

**Qué deberías ver:** en el celular, en Dispositivos vinculados, un dispositivo nuevo. El celular sigue funcionando normal.

**Si falla:** si el QR caduca antes de escanearlo, espera el siguiente (se renueva solo). Si dice `need_scan` después de escanear, vuelve a apretar Connect.

## Paso 13 · Llevar las claves al `.env`

```bash
npx tsx --env-file=.env credenciales.ts          # muestra la tabla: anota el id de woki-demo
npx tsx --env-file=.env credenciales.ts 12       # (tu id) guarda key, id y secreto en .env
```

**Qué deberías ver:** `Sesión 12 (woki-demo · connected) guardada en .env`.

**Si falla:** "La sesión no devolvió su key": cópiala a mano desde la página de la sesión en el dashboard y pégala en `WAPI_API_KEY`. Haz lo mismo con el webhook secret.

## Paso 14 · Contactos reales y webhook

1. En `profile.json`, reemplaza los `+569XXXXXXXX` por los números reales, con `+` y código de país. En la demo, "Sofía" y "Camila" son celulares de personas del equipo.
2. Registra el webhook a la sesión real (toma `WAPI_SESSION_ID` del `.env`):

```bash
npx tsx --env-file=.env setup-webhook.ts https://algo-algo-algo.trycloudflare.com
```

## Paso 15 · Encender en modo real

1. En `.env`, cambia `WA_MODE=dry` por `WA_MODE=live`.
2. Terminal 1: `npm run dev`.
3. `curl -s localhost:8787/api/wa/health` → `"mode":"live","session":"connected"`.
4. Desde la TV, envía "prueba WOKI" a Sofía. Tiene que llegar al celular de Sofía, desde el número del equipo.
5. Sofía responde desde su celular. La TV tiene que mostrarlo.

En modo real, cada envío espera unos 5 s por account protection. Es normal.

---

# Parte 7 · Antes de la demo

## Paso 16 · Ensayo

| Prueba | Resultado esperado |
|---|---|
| Ceja, ceja muy rápido, dos veces | Llega un solo mensaje |
| Una ceja y esperar | "No se envió: faltó la segunda ceja" |
| Alguien fuera de la lista le escribe al número | No aparece en la TV |
| Apagar el puente | La TV muestra "WhatsApp sin conexión" y sigue funcionando |
| Ciclo completo: Sofía escribe → Marta responde | Menos de 20 s |

## Checklist antes de subir al escenario

- [ ] `health` dice `"session":"connected"` y `"mode":"live"`
- [ ] Terminal de `cloudflared` abierta y el webhook apuntando a su URL actual
- [ ] `sentToday` lejos del tope de 30
- [ ] Hotspot del iPhone listo por si falla el Wi-Fi (el envío no necesita túnel, solo la recepción)
- [ ] Video de 15 s del ciclo real grabado como plan B
- [ ] Los celulares de "Sofía" y "Camila" con batería y en silencio, salvo el que se muestra

## Las 3 terminales durante la demo

| Terminal | Comando | Para qué |
|---|---|---|
| 1 | `npm run dev` (en `woki-bridge`) | El puente |
| 2 | `cloudflared tunnel --url http://localhost:8787` | Recibir mensajes |
| 3 | El servidor del prototipo en el puerto 8000 (ya corre) | La TV |

---

# Si algo falla (resumen)

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| `403` de wapi | Usaste el PAT donde va la session key, o al revés | Enviar o ver estado: session key. Sandbox, webhook o leer claves: PAT |
| `401` de wapi | Clave mal copiada o revocada | Crea otra en el dashboard |
| `401` en `/webhook/wapi` | El secreto no corresponde a esa sesión | Sandbox: repite el Paso 4. Real: repite el Paso 13 |
| No llega nada a la TV | Túnel caído o webhook con una URL vieja | Reabre `cloudflared` y repite el Paso 7.2 o el 14 |
| Llega el aviso pero no aparece | El remitente vino como LID y no coincide | Con `DEBUG_WEBHOOK=1`, copia el LID del aviso y agrégalo como `"lid"` al contacto en `profile.json` |
| Mensaje repetido en la TV | Reintento de wapi | Ya se deduplica; si pasa, revisa que el puente no esté lento |
| `session` ≠ `connected` | El celular perdió el vínculo | Abre WhatsApp en el celular; si sigue igual, repite el Paso 12 |
| Error de CORS en el navegador | El prototipo se abrió desde otra dirección | `ALLOWED_ORIGIN` en `.env` igual a la dirección exacta del navegador |

## Fuentes

- Documentación de wapi: [wapi.crafter.run/docs](https://wapi.crafter.run/docs) · [quickstart](https://wapi.crafter.run/docs/quickstart) · [autenticación](https://wapi.crafter.run/docs/authentication) · [sandbox](https://wapi.crafter.run/docs/sandbox) · [sesiones](https://wapi.crafter.run/docs/guides/sessions) · [webhooks](https://wapi.crafter.run/docs/guides/webhooks)
- Código fuente: [github.com/crafter-station/wapi](https://github.com/crafter-station/wapi)
- En este Mac: `wspbot/README.md` (secciones "Notes on the wapi integration" y "Pointing wapi at it") y `wspbot/.agents/skills/wapi-nextjs/`

**No documentado en wapi** (preguntar a Crafter Station si importa): cómo se obtiene una cuenta, si tiene costo o límites de uso, y en qué parte del dashboard aparece el webhook secret de una sesión real. Por eso `credenciales.ts` lo lee por API.
