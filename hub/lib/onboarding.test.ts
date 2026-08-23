import { describe, expect, test } from "bun:test";

import { resourceOnboarding } from "./onboarding";

describe("onboarding del nodo de recurso", () => {
  test("mantiene cada paso breve y enlazado a una fuente del repositorio", () => {
    const guide = resourceOnboarding();

    for (const step of guide.steps) {
      expect(step.facts.length).toBeLessThanOrEqual(3);
      expect(step.documentation).toStartWith(
        "https://github.com/platanus-hack/platanus-hack-26-co-team-28/",
      );
    }
  });

  test("obliga a conectar la antena antes de alimentar o flashear la placa", () => {
    const guide = resourceOnboarding();
    const antenna = guide.steps.findIndex((step) => step.id === "antenna");
    const usb = guide.steps.findIndex((step) => step.id === "usb");

    expect(antenna).toBeGreaterThan(-1);
    expect(usb).toBeGreaterThan(antenna);
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

  test("ofrece el mismo flasheo a usuarios técnicos y enlaza la documentación fuente", () => {
    const configure = resourceOnboarding().steps.find((step) => step.id === "configure");

    expect(configure?.command).toBe(
      "bash lora-emergencia/scripts/flash.sh nodo_recurso <puerto>",
    );
    expect(configure?.documentation).toContain("lora-emergencia/docs/SETUP.md");
  });
});
