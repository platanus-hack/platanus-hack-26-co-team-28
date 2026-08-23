import { describe, expect, test } from "bun:test";

import { copyPromptThenMaybeOpen } from "./prompt-actions";

describe("acciones del prompt", () => {
  test("confirma la copia antes de abrir la IA", async () => {
    const events: string[] = [];

    await copyPromptThenMaybeOpen({
      destinationUrl: "https://chatgpt.com/",
      openAfterCopy: true,
      prompt: "Configura WOKI en español",
      dependencies: {
        writeText: async (text) => {
          events.push(`copiar:${text}`);
        },
        openDestination: (url) => events.push(`abrir:${url}`),
      },
    });

    expect(events).toEqual([
      "copiar:Configura WOKI en español",
      "abrir:https://chatgpt.com/",
    ]);
  });

  test("no abre la IA cuando el navegador rechaza la copia", async () => {
    let opened = false;

    await expect(copyPromptThenMaybeOpen({
      destinationUrl: "https://claude.ai/new",
      openAfterCopy: true,
      prompt: "Configura WOKI en español",
      dependencies: {
        writeText: async () => {
          throw new Error("clipboard-denied");
        },
        openDestination: () => {
          opened = true;
        },
      },
    })).rejects.toThrow("clipboard-denied");

    expect(opened).toBe(false);
  });
});
