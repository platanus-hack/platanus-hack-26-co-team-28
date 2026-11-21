// woki-bridge/setup-emergencia.ts · crea (una vez) el agente telefónico de emergencia en ElevenLabs.
// Uso: npx tsx --env-file=.env setup-emergencia.ts
// Imprime ELEVENLABS_AGENT_ID (y ELEVENLABS_PHONE_NUMBER_ID si hay credenciales de Twilio) para pegar en .env.
const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY) throw new Error("Falta ELEVENLABS_API_KEY en .env");
const XI = "https://api.elevenlabs.io";

async function post(path: string, body: unknown) {
  const r = await fetch(XI + path, { method: "POST", headers: { "xi-api-key": KEY!, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${path} → HTTP ${r.status}: ${JSON.stringify(j).slice(0, 400)}`);
  return j;
}

// Variables que el bridge manda en cada llamada: {{persona}}, {{direccion}}, {{hora}}, {{motivo}}
const PROMPT = `Eres WOKI, el asistente de comunicación de {{persona}}. {{persona}} tiene ELA y no puede hablar.
Estás llamando por teléfono a su contacto de emergencia porque {{persona}} {{motivo}} a las {{hora}} en {{direccion}}.

Reglas:
- Habla en español, frases cortas, tono calmado y claro. Nunca digas que eres {{persona}}.
- Tu único objetivo: que la persona que contesta confirme que va a ir o que va a conseguir ayuda.
- Si pregunta qué le pasa: explica que no lo sabes, que {{persona}} solo pudo activar la alarma con un gesto.
- Si no puede ir: pídele que llame a otra persona de la familia o a emergencias (SAMU 131 en Chile), y repite la dirección.
- Si confirma que va: agradece, repite la dirección una vez y termina la llamada.
- Si contesta un buzón de voz: deja el mensaje completo con la dirección y la hora, y corta.
- No inventes datos médicos ni prometas nada que no sabes.`;

const agent = await post("/v1/convai/agents/create", {
  name: "WOKI · emergencia",
  conversation_config: {
    agent: {
      language: "es",
      first_message: "Hola, te llamo de WOKI, el asistente de {{persona}}. {{persona}} activó la alarma de emergencia a las {{hora}}. ¿Puedes ir ahora a {{direccion}}?",
      prompt: { prompt: PROMPT },
    },
    // Voz neutra del asistente (no la de Marta: quien contesta no debe creer que ella está hablando).
    tts: { voice_id: process.env.ELEVENLABS_AGENT_VOICE_ID ?? "cjVigY5qzO86Huf0OWal", model_id: "eleven_flash_v2_5" },
  },
});
console.log(`ELEVENLABS_AGENT_ID=${agent.agent_id}`);

const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_PHONE_NUMBER: phone } = process.env;
if (sid && token && phone) {
  const num = await post("/v1/convai/phone-numbers", { provider: "twilio", phone_number: phone, label: "WOKI emergencia", sid, token, agent_id: agent.agent_id });
  console.log(`ELEVENLABS_PHONE_NUMBER_ID=${num.phone_number_id}`);
} else {
  console.log("Sin TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_PHONE_NUMBER: importa el número en ElevenLabs → Agents → Phone numbers y copia su id.");
}

export {};
