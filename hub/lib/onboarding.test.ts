import { describe, expect, test } from "bun:test";

import { resourceOnboarding } from "./onboarding";

describe("onboarding del nodo de recurso", () => {
  test("empieza obteniendo el repositorio antes de preparar el hardware", () => {
    const guide = resourceOnboarding();

    expect(guide.steps).toHaveLength(7);
    expect(guide.steps[0].id).toBe("source");
    expect(guide.steps[0].command).toContain("git clone");
    expect(guide.steps[0].documentation).toBe(
      "https://github.com/platanus-hack/platanus-hack-26-co-team-28",
    );
  });

  test("mantiene cada paso breve y enlazado a una fuente del repositorio", () => {
    const guide = resourceOnboarding();

    for (const step of guide.steps) {
      expect(step.facts.length).toBeLessThanOrEqual(3);
      expect(step.documentation).toStartWith(
        "https://github.com/platanus-hack/platanus-hack-26-co-team-28",
      );
    }
  });

  test("obliga a conectar la antena antes de preparar Maestro o Esclavo", () => {
    const guide = resourceOnboarding();
    const antenna = guide.steps.findIndex((step) => step.id === "antenna");
    const master = guide.steps.findIndex((step) => step.id === "master");
    const slave = guide.steps.findIndex((step) => step.id === "slave");

    expect(antenna).toBeGreaterThan(-1);
    expect(master).toBeGreaterThan(antenna);
    expect(slave).toBeGreaterThan(master);
    expect(guide.steps[antenna].blocking).toBe(true);
  });

  test("entrega la red y dirección locales que abre el celular sin internet", () => {
    const localWifi = resourceOnboarding().steps.find((step) => step.id === "local-wifi");

    expect(localWifi?.facts).toEqual(expect.arrayContaining([
      "RECURSO_GRUA07",
      "http://192.168.4.1",
      "Es normal que el celular indique “sin internet”.",
    ]));
  });

  test("ubica cada instalador en el paso del dispositivo correspondiente", () => {
    const guide = resourceOnboarding();
    const source = guide.steps.find((step) => step.id === "source");
    const master = guide.steps.find((step) => step.id === "master");
    const slave = guide.steps.find((step) => step.id === "slave");

    expect(source?.command).not.toContain("instalar_maestro");
    expect(source?.command).not.toContain("instalar_esclavo");
    expect(master?.command).toBe("bash lora-emergencia/scripts/instalar_maestro.sh");
    expect(slave?.command).toBe("bash lora-emergencia/scripts/instalar_esclavo.sh");
    expect(master?.documentation).toContain("OPERAR-SINCRONIZACION.md");
    expect(slave?.documentation).toContain("lora-emergencia/center/CENTRO.md");
  });

  test("publica un prompt sin secretos para delegar la instalación a otra IA", async () => {
    const prompt = await Bun.file(
      new URL("../public/onboarding/WOKI-SETUP-PROMPT.md", import.meta.url),
    ).text();

    expect(prompt).toContain("https://github.com/platanus-hack/platanus-hack-26-co-team-28.git");
    expect(prompt).toContain("LoRa Maestro");
    expect(prompt).toContain("LoRa Esclavo");
    expect(prompt).toContain("Nunca energices");
    expect(prompt).toContain("WOKI_SYNC_TOKEN");
    expect(prompt).not.toContain("sk-ant-");
    expect(prompt).not.toContain("sbp_");
  });
});
