import { describe, expect, test } from "bun:test";

import { buildSpanishNarration } from "./onboarding-ai";

describe("guías de IA del onboarding", () => {
  test("ElevenLabs recibe una narración completa en español para el paso", () => {
    const narration = buildSpanishNarration("local-wifi");

    expect(narration).toContain("Conéctate a la red local");
    expect(narration).toContain("RECURSO_GRUA07");
    expect(narration).toContain("sin internet");
  });
});
