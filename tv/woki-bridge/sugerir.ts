// woki-bridge/sugerir.ts — respuestas sugeridas y predicción por iniciales con Claude.
// Usa el CLI `claude` con la suscripción del usuario (sin API key). Cada llamada tarda unos 2–3 s,
// así que el puente las adelanta al llegar un mensaje y la TV muestra primero las frases locales.
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";

export type Sug = { text: string; tone: string; emo: string };
export type Line = { dir: "in" | "out"; text: string };

const MODEL = process.env.SUGGEST_MODEL ?? "haiku";
export const sugOn = process.env.SUGGEST !== "off";
const EMOS = ["seria", "alegre", "carinosa", "ironica", "susurro", "entusiasta"];

const SYSTEM = `Eres el motor de respuestas de WOKI, un comunicador para Marta, una mujer con ELA que no puede hablar ni escribir rápido: elige frases con la mirada.
Escribes en primera persona como Marta, en español latinoamericano, en femenino, frases cortas (máx. 8 palabras; ideal 3 a 6), naturales, como un mensaje de WhatsApp.
Respondes SOLO con JSON válido, sin texto extra ni markdown: {"suggestions":[{"text":"...","tone":"2-3 palabras","emo":"seria|alegre|carinosa|ironica|susurro|entusiasta"}]}`;

function runClaude(prompt: string, timeoutMs = 15_000): Promise<string> {
  return new Promise((ok, ko) => {
    // --setting-sources project + cwd temporal: sin hooks ni CLAUDE.md del usuario (≈2,5 s en vez de ≈7 s)
    const p = spawn("claude", ["-p", "--model", MODEL, "--tools", "", "--no-session-persistence",
      "--setting-sources", "project", "--system-prompt", SYSTEM], { cwd: tmpdir(), stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    const t = setTimeout(() => { p.kill(); ko(new Error("timeout")); }, timeoutMs);
    p.stdout.on("data", (d) => (out += d));
    p.on("error", (e) => { clearTimeout(t); ko(e); });
    p.on("close", (code) => { clearTimeout(t); code === 0 ? ok(out) : ko(new Error("claude salió con " + code)); });
    p.stdin.end(prompt);
  });
}

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const initialsOf = (t: string) => (fold(t).match(/[a-zñ0-9]+/g) ?? []).map((w) => w[0]).join("");

function parse(raw: string, ini?: string): Sug[] {
  const m = raw.match(/\{[\s\S]*\}/); if (!m) return [];
  let list: any[] = [];
  try { list = JSON.parse(m[0]).suggestions ?? []; } catch { return []; }
  const seen = new Set<string>();
  return list
    // sin < >: el texto viene de un modelo que lee mensajes de terceros (defensa además del escape en la TV)
    .map((x) => ({ text: String(x?.text ?? "").replace(/[<>]/g, "").trim().slice(0, 160), tone: String(x?.tone ?? "").replace(/[<>]/g, "").slice(0, 30), emo: EMOS.includes(x?.emo) ? x.emo : "seria" }))
    .filter((x) => x.text && !seen.has(x.text) && seen.add(x.text))
    // por iniciales: primero las que respetan exactamente las letras
    .sort((a, b) => (ini ? Number(initialsOf(b.text) === ini) - Number(initialsOf(a.text) === ini) : 0));
}

function chatBlock(name: string, relation: string, lines: Line[]) {
  const last = lines.slice(-14).map((l) => `${l.dir === "in" ? name : "Marta"}: ${l.text.replace(/\s+/g, " ").slice(0, 300)}`).join("\n");
  return `Conversación de WhatsApp con ${name}${relation ? ` (${relation})` : ""}. Lo último está abajo:\n${last || "(sin mensajes todavía)"}`;
}

/** 6 respuestas para lo último que pasó en el chat (variadas: sí / no / pregunta / emoción). */
export async function suggestReplies(name: string, relation: string, lines: Line[], extra = ""): Promise<Sug[]> {
  const prompt = `${chatBlock(name, relation, lines)}
${extra ? `Contexto adicional del acompañante: ${extra}\n` : ""}
Propón 6 respuestas distintas que Marta podría mandar ahora mismo a ${name}. Cubre opciones diferentes: aceptar, rechazar o dudar, preguntar algo concreto, y una afectiva. Si el último mensaje es de Marta, propón cómo seguir la conversación.`;
  return parse(await runClaude(prompt)).slice(0, 6);
}

/** Frases cuyas palabras empiezan, en orden, por las letras elegidas (predicción paso a paso). */
export async function expandInitials(name: string, relation: string, lines: Line[], ini: string): Promise<Sug[]> {
  const L = [...ini].map((c) => c.toUpperCase()).join(" · ");
  const prompt = `${chatBlock(name, relation, lines)}

Marta está escribiendo su respuesta letra por letra: elige solo la PRIMERA letra de cada palabra. Lleva estas iniciales: ${L}
Propón 5 frases que encajen con la conversación cuyas palabras empiecen, en orden, EXACTAMENTE por esas letras (${ini.length} palabras; las contracciones cuentan como una palabra). Si con esas letras la frase parece incompleta, puedes añadir hasta 3 palabras más al final; ponlas después de las que sí respetan las letras. Ordena de la más probable a la menos.`;
  return parse(await runClaude(prompt), ini).slice(0, 5);
}
