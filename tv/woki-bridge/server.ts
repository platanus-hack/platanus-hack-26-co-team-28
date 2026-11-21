// woki-bridge/server.ts
import http from "node:http";
import { readFileSync, writeFileSync, renameSync, existsSync, chmodSync } from "node:fs";
import { createHmac, timingSafeEqual } from "node:crypto";
import { WapiClient } from "./wapi-sdk/index.ts";
import { handleVoz, vozHealth } from "./voz.ts"; // ElevenLabs: voz, clonación y llamada de emergencia
import { sugOn, suggestReplies, expandInitials, type Sug, type Line } from "./sugerir.ts"; // Claude: respuestas y predicción

// ---------- configuración ----------
type Mode = "off" | "dry" | "sandbox" | "live";
const MODE = (process.env.WA_MODE ?? "dry") as Mode;
const PORT = Number(process.env.PORT ?? 8787);
const ORIGIN = process.env.ALLOWED_ORIGIN ?? "http://localhost:8000";
const SECRET = process.env.WAPI_WEBHOOK_SECRET ?? "";
const API_TOKEN = process.env.WOKI_API_TOKEN ?? ""; // opcional: si existe, /api/* exige el header X-Woki-Token
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
const profileUrl = new URL(profileFile, import.meta.url);
let { contacts } = JSON.parse(readFileSync(profileUrl, "utf8")) as { contacts: Contact[] };
let byId = new Map(contacts.map((c) => [c.id, c]));
const digits = (s: string) => s.replace(/\D/g, "");
const MAX_FAVS = 6; // contactos principales: caben en la grilla de la TV

// Guarda la lista blanca (escritura atómica: archivo temporal + rename).
function saveProfile(next: Contact[]) {
  const tmp = new URL(profileFile + ".tmp", import.meta.url);
  writeFileSync(tmp, JSON.stringify({ contacts: next }, null, 2) + "\n");
  renameSync(tmp, profileUrl);
  contacts = next;
  byId = new Map(contacts.map((c) => [c.id, c]));
}

// Agenda de WhatsApp (vía wapi), en caché 2 min: no se guarda en disco.
type WaContact = { jid: string; name: string; phone: string; lid?: string };
let agenda: { at: number; list: WaContact[] } | null = null;
async function loadAgenda(): Promise<WaContact[]> {
  if (agenda && Date.now() - agenda.at < 120_000) return agenda.list;
  const raw: any[] = await wapi!.contacts.list();
  const list = raw
    .filter((c) => String(c.jid ?? c.id ?? "").endsWith("@s.whatsapp.net"))
    .map((c) => {
      const phone = "+" + digits(String(c.phoneNumber ?? c.jid ?? c.id).split("@")[0]);
      return { jid: String(c.jid ?? c.id), name: String(c.name || c.notify || c.verifiedName || phone), phone, lid: c.lid ? user(String(c.lid)) : undefined };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
  agenda = { at: Date.now(), list };
  return list;
}
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

// ---------- historial de chat (en disco: history.json, solo dueño, fuera de git) ----------
// wapi no guarda los mensajes recibidos: el historial se arma con los avisos que llegan
// y se guarda en disco para que sobreviva a los reinicios. Solo contactos principales.
type ChatMsg = { id: string; dir: "in" | "out"; text: string; at: number; via?: "tv" | "phone"; msgId?: number; status?: number };
const HIST_MAX = 60;
const histUrl = new URL("history.json", import.meta.url);
const history = new Map<string, ChatMsg[]>(existsSync(histUrl) ? Object.entries(JSON.parse(readFileSync(histUrl, "utf8"))) : []);
let histTimer: NodeJS.Timeout | null = null;
function saveHist() {               // escritura atómica y agrupada (1 s)
  if (histTimer) return;
  histTimer = setTimeout(() => {
    histTimer = null;
    const tmp = new URL("history.json.tmp", import.meta.url);
    writeFileSync(tmp, JSON.stringify(Object.fromEntries(history)), { mode: 0o600 });
    renameSync(tmp, histUrl); chmodSync(histUrl, 0o600);
  }, 1_000);
}
const recentTv: { cid: string; text: string; at: number }[] = []; // envíos de la TV, para no duplicarlos cuando wapi avisa "message.sent"
function pushHist(cid: string, m: ChatMsg) {
  const list = history.get(cid) ?? [];
  if (list.some((x) => x.id === m.id)) return;
  list.push(m);
  if (list.length > HIST_MAX) list.splice(0, list.length - HIST_MAX);
  history.set(cid, list);
  saveHist();
  emit({ type: "chat", contactId: cid, msg: m });
}

// ---------- sugerencias con Claude (adelantadas al llegar un mensaje) ----------
const sugCache = new Map<string, { at: number; list: Sug[] }>();
const sugBusy = new Map<string, Promise<Sug[]>>();
const linesOf = (cid: string): Line[] => (history.get(cid) ?? []).map(({ dir, text }) => ({ dir, text }));
const lastId = (cid: string) => (history.get(cid) ?? []).at(-1)?.id ?? "-";
function suggestFor(cid: string, ini = "", extra = ""): Promise<Sug[]> {
  const c = byId.get(cid); if (!c || !sugOn) return Promise.resolve([]);
  const k = `${cid}|${lastId(cid)}|${ini}|${extra}`;
  const hit = sugCache.get(k); if (hit && Date.now() - hit.at < 10 * 60_000) return Promise.resolve(hit.list);
  if (sugBusy.has(k)) return sugBusy.get(k)!;
  const p = (ini ? expandInitials(c.name, c.relation, linesOf(cid), ini) : suggestReplies(c.name, c.relation, linesOf(cid), extra))
    .then((list) => { if (list.length) sugCache.set(k, { at: Date.now(), list }); if (sugCache.size > 200) sugCache.delete(sugCache.keys().next().value!); return list; })
    .catch((e) => { console.log(`[sugerir] sin respuesta de Claude (${e.message})`); return [] as Sug[]; })
    .finally(() => sugBusy.delete(k));
  sugBusy.set(k, p); return p;
}
function prefetchSuggest(cid: string) {
  const key = lastId(cid);
  suggestFor(cid).then((list) => { if (list.length) emit({ type: "suggest", contactId: cid, key, suggestions: list }); });
}
const textOf = (m: any): string =>
  String(m?.conversation ?? m?.extendedTextMessage?.text ?? m?.imageMessage?.caption ?? m?.videoMessage?.caption ?? "");
const contextOf = (m: any): any => {
  for (const v of Object.values(m ?? {})) if (v && typeof v === "object" && (v as any).contextInfo) return (v as any).contextInfo;
  return undefined;
};

// ---------- menciones en grupos (solo aviso: WOKI no responde en grupos) ----------
let me: { ids: Set<string> } = { ids: new Set() }; // mi número y mi LID, sin dominio
async function loadMe() {
  if (!wapi) return;
  try {
    const u = await wapi.user();
    me = { ids: new Set([user(u.id), u.lid ? user(u.lid) : ""].filter(Boolean)) };
  } catch (e: any) { console.warn("[me] no pude leer mi identidad:", e?.message); }
}
const groupNames = new Map<string, string>();
async function groupName(jid: string) {
  if (groupNames.has(jid)) return groupNames.get(jid)!;
  let name = "un grupo";
  try { const g = await wapi!.groups.metadata(jid); name = g.subject || g.name || name; } catch { /* sin nombre */ }
  groupNames.set(jid, name);
  return name;
}
async function personName(participant?: string, pushName?: string) {
  const id = user(participant);
  const fav = contacts.find((c) => digits(c.phone) === id || c.lid === id);
  if (fav) return fav.name;
  try { const a = (await loadAgenda()).find((c) => digits(c.phone) === id || c.lid === id); if (a) return a.name; } catch { /* sigue */ }
  return pushName || "Alguien";
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
      if (s !== last) {
        last = s;
        const h = history.get(contactId)?.find((x) => x.msgId === msgId); if (h) { h.status = s; saveHist(); }
        emit({ type: "status", msgId, contactId, status: s });
      }
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
    res.writeHead(204, { "Access-Control-Allow-Origin": ORIGIN, "Access-Control-Allow-Methods": "GET,POST", "Access-Control-Allow-Headers": "Content-Type, X-Woki-Token" });
    return res.end();
  }

  // Anti-CSRF: cualquier página abierta en el navegador podría hacer POST a localhost.
  // Las rutas /api/* solo aceptan JSON (fuerza preflight CORS) y el Origin exacto de la app.
  // El webhook de wapi queda fuera: se autentica con su firma (WAPI_WEBHOOK_SECRET).
  if (url.pathname.startsWith("/api/")) {
    // 1) /api/* es solo para la app local. Lo que entra por un túnel trae estos encabezados → fuera,
    //    así una URL de túnel filtrada no permite mandar ni leer mensajes (solo /webhook/wapi es público).
    const h = req.headers;
    if (h["cf-connecting-ip"] || h["cf-ray"] || h["x-forwarded-for"] || h["x-forwarded-host"] || h["ngrok-trace-id"])
      return json(res, 403, { ok: false, reason: "api solo local" });
    // 2) Token compartido opcional (recomendado): si WOKI_API_TOKEN está en .env, la app debe mandar X-Woki-Token.
    if (API_TOKEN) {
      const tok = String(h["x-woki-token"] ?? "");
      if (!tok || !safeEqual(tok, API_TOKEN)) return json(res, 401, { ok: false, reason: "token inválido" });
    }
    // 3) POST: solo JSON (fuerza preflight CORS) y desde el Origin exacto de la app.
    if (req.method === "POST") {
      const ctype = String(h["content-type"] ?? "").split(";")[0].trim();
      if (h.origin !== ORIGIN || ctype !== "application/json")
        return json(res, 403, { ok: false, reason: "origen o content-type no permitido" });
    }
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
      pushHist(c.id, { id: "dry-" + idemKey, dir: "out", text: body, at: Date.now(), via: "tv" });
      emit({ type: "status", msgId: -1, contactId, status: 2 });
      return json(res, 200, { ok: true, msgId: -1, dry: true });
    }
    try {
      recentTv.push({ cid: c.id, text: body, at: Date.now() });
      const sent = await wapi!.messages.send({ to: "+" + digits(c.phone), text: body });
      console.log(`[send] ${c.name} msgId=${sent.msgId}`);
      pushHist(c.id, { id: "api-" + sent.msgId, dir: "out", text: body, at: Date.now(), via: "tv", msgId: sent.msgId });
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

  // Panel de contactos ← agenda completa de WhatsApp (solo lectura, solo esta app por CORS)
  if (req.method === "GET" && url.pathname === "/api/wa/contacts") {
    if (!wapi) return json(res, 503, { ok: false, reason: "La agenda solo está disponible en modo live o sandbox" });
    try {
      const favs = new Set(contacts.map((c) => digits(c.phone)));
      const list = (await loadAgenda()).map((c) => ({ ...c, fav: favs.has(digits(c.phone)) }));
      return json(res, 200, { ok: true, contacts: list });
    } catch (e: any) {
      console.error("[contacts] error", e?.status, e?.message);
      return json(res, 502, { ok: false, reason: "wapi no devolvió la agenda" });
    }
  }

  // Contactos principales (la lista blanca): leer
  if (req.method === "GET" && url.pathname === "/api/wa/favorites") {
    return json(res, 200, { ok: true, max: MAX_FAVS, contacts: contacts.map(({ id, name, relation, phone, tone }) => ({ id, name, relation, phone, tone })) });
  }

  // Contactos principales: reemplazar. Solo números que existen en la agenda de WhatsApp.
  if (req.method === "POST" && url.pathname === "/api/wa/favorites") {
    let body: any;
    try { body = JSON.parse((await readBody(req)) || "{}"); } catch { return json(res, 400, { ok: false, reason: "JSON inválido" }); }
    const picked: any[] = Array.isArray(body.contacts) ? body.contacts : [];
    if (picked.length > MAX_FAVS) return json(res, 400, { ok: false, reason: `Máximo ${MAX_FAVS} contactos principales` });
    let book: WaContact[] = [];
    if (wapi) { try { book = await loadAgenda(); } catch { return json(res, 502, { ok: false, reason: "wapi no devolvió la agenda" }); } }
    const byPhone = new Map(book.map((c) => [digits(c.phone), c]));
    const clean = (s: unknown, n: number) => String(s ?? "").replace(/[<>]/g, "").trim().slice(0, n);
    const next: Contact[] = [];
    for (const p of picked) {
      const d = digits(String(p.phone ?? ""));
      const known = byPhone.get(d);
      if (!d || (wapi && !known)) return json(res, 400, { ok: false, reason: `El número ${clean(p.phone, 20)} no está en tu WhatsApp` });
      if (next.some((c) => digits(c.phone) === d)) continue;
      const prev = contacts.find((c) => digits(c.phone) === d);
      next.push({
        id: prev?.id ?? "c" + d,
        name: clean(p.name, 40) || known?.name || "+" + d,
        relation: clean(p.relation, 30) || prev?.relation || "",
        tone: clean(p.tone, 60) || prev?.tone || "",
        phone: "+" + d,
        lid: known?.lid ?? prev?.lid,
      });
    }
    saveProfile(next);
    console.log(`[favorites] ${next.length} contactos principales guardados`);
    return json(res, 200, { ok: true, contacts: next.map(({ id, name, relation, phone, tone }) => ({ id, name, relation, phone, tone })) });
  }

  // Historial de chat con un contacto principal (memoria del puente)
  if (req.method === "GET" && url.pathname === "/api/wa/history") {
    const cid = url.searchParams.get("contactId") ?? "";
    if (!byId.has(cid)) return json(res, 403, { ok: false, reason: "Contacto fuera de la lista" });
    return json(res, 200, { ok: true, messages: history.get(cid) ?? [] });
  }

  // Respuestas sugeridas por Claude para un contacto principal: {contactId, initials?, context?}
  if (req.method === "POST" && url.pathname === "/api/wa/suggest") {
    let b: any = {}; try { b = JSON.parse(await readBody(req)); } catch { return json(res, 400, { ok: false, reason: "JSON inválido" }); }
    const cid = String(b.contactId ?? "");
    if (!byId.has(cid)) return json(res, 403, { ok: false, reason: "Contacto fuera de la lista" });
    const ini = String(b.initials ?? "").toLowerCase().replace(/[^a-zñ0-9]/g, "").slice(0, 16);
    const extra = String(b.context ?? "").replace(/[<>]/g, "").slice(0, 300);
    const list = await suggestFor(cid, ini, extra);
    return json(res, 200, { ok: true, source: list.length ? "claude" : "none", key: lastId(cid), suggestions: list });
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
    return json(res, 200, { mode: MODE, session, sentToday, contacts: contacts.map((c) => c.id), voz: vozHealth() });
  }

  // wapi → mensaje entrante (firmado)
  if (req.method === "POST" && url.pathname === "/webhook/wapi") {
    const raw = await readBody(req);
    if (!verify(raw, req.headers["x-webhook-signature"] as string | undefined)) { res.writeHead(401); return res.end(); }
    res.writeHead(200); res.end("ok"); // responder YA: wapi reintenta si tardamos
    setImmediate(() => handleEvent(raw));
    return;
  }

  // ElevenLabs (/api/voz/*, /api/emergencia/*): ya pasó por las comprobaciones de /api/* de arriba
  if (await handleVoz(req, res, url, ORIGIN)) return;

  res.writeHead(404); res.end();
});

function handleEvent(raw: string) {
  let ev: { event: string; data: any };
  try { ev = JSON.parse(raw); } catch { return; }
  if (process.env.DEBUG_WEBHOOK) console.log("[webhook]", raw.slice(0, 2000));

  if (ev.event === "session.status") return emit({ type: "session", status: ev.data?.status });

  const key = ev.data?.key ?? {};
  const m = ev.data?.message ?? {};
  const isGroup = String(key.remoteJid ?? "").endsWith("@g.us");

  // Lo que yo envío (desde la TV o escribiendo en el celular) → al historial del contacto.
  if (ev.event === "message.sent") {
    if (isGroup) return;
    const c = findSender(key); if (!c) return;
    const text = textOf(m).trim(); if (!text) return;
    const i = recentTv.findIndex((r) => r.cid === c.id && r.text === text && Date.now() - r.at < 120_000);
    if (i >= 0) { recentTv.splice(i, 1); return; }                             // ya lo anotó /api/wa/send
    pushHist(c.id, { id: String(key.id ?? "out-" + Date.now()), dir: "out", text, at: Date.now(), via: "phone" });
    return;
  }
  if (ev.event !== "messages.received" || key.fromMe) return;
  if (key.id && seenInbound.has(key.id)) return;                              // reintento de wapi
  if (key.id) seenInbound.add(key.id);

  // Grupo: solo importa si me mencionan. Todo lo demás se descarta aquí mismo (no se guarda ni se muestra).
  if (isGroup) { void handleGroup(key, m, ev.data?.pushName); return; }

  const c = findSender(key);
  if (!c) return;                                                             // fuera de la lista: ni se muestra ni se guarda
  const text = textOf(m);
  if (!text) return;                                                          // por ahora solo texto
  console.log(`[in] ${c.name}: ${text}`);
  pushHist(c.id, { id: String(key.id ?? "in-" + Date.now()), dir: "in", text, at: Date.now() });
  emit({ type: "incoming", contactId: c.id, name: c.name, relation: c.relation, tone: c.tone, text, key });
  prefetchSuggest(c.id);                                                     // las respuestas de Claude llegan por SSE ("suggest")
}

async function handleGroup(key: any, m: any, pushName?: string) {
  if (!me.ids.size) return;
  const mentioned: string[] = (contextOf(m)?.mentionedJid ?? []).map((j: string) => user(j));
  if (!mentioned.some((id) => me.ids.has(id))) return;
  const [group, from] = await Promise.all([groupName(String(key.remoteJid)), personName(key.participant ?? key.participantAlt, pushName)]);
  let text = textOf(m);
  for (const id of me.ids) text = text.split("@" + id).join("@Tú");          // "@573…" → "@Tú"
  console.log(`[mención] en un grupo`);                                       // sin nombres ni texto en el log
  emit({ type: "mention", group, from, text: text.slice(0, 280), at: Date.now() });
}

await resolveLids();
await loadMe();
// Solo en localhost: el túnel (cloudflared, etc.) se conecta a 127.0.0.1 igual, y nadie de la red local puede llamar a /api/*.
server.listen(PORT, "127.0.0.1", () => console.log(`woki-bridge · modo ${MODE} · ${contacts.length} contactos · http://localhost:${PORT}`));
