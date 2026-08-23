import { describe, expect, test } from "bun:test";

import { buildAssistantPrompt, buildSpanishNarration } from "./onboarding-ai";

describe("guías de IA del onboarding", () => {
  test("ElevenLabs recibe una narración completa en español para el paso", () => {
    const narration = buildSpanishNarration("local-wifi");

    expect(narration).toContain("Conéctate a la red local");
    expect(narration).toContain("RECURSO_GRUA07");
    expect(narration).toContain("sin internet");
  });

  test("Anthropic queda limitado al paso y a su documentación fuente", () => {
    const prompt = buildAssistantPrompt("antenna");

    expect(prompt.instructions).toContain("Responde siempre en español");
    expect(prompt.instructions).toContain("máximo 45 palabras");
    expect(prompt.context).toContain("Conecta primero la antena");
    expect(prompt.context).toContain("lora-emergencia/docs/HARDWARE.md");
  });
});
