import { describe, expect, test } from "bun:test";
import { COMMAND_CENTER_ROUTES } from "./command-center-routes";

describe("navegación del Centro LoRa online", () => {
  test("expone cada módulo operacional como una página independiente", () => {
    expect(COMMAND_CENTER_ROUTES.map(({ href }) => href)).toEqual([
      "/command-center",
      "/command-center/requests",
      "/command-center/resources",
      "/command-center/network",
      "/command-center/broadcasts",
      "/command-center/safe-people",
    ]);
  });

  test("mantiene la configuración fuera de los módulos operacionales", () => {
    const routes: string[] = COMMAND_CENTER_ROUTES.map(({ href }) => href);
    expect(routes).not.toContain("/setup");
    expect(new Set(routes).size).toBe(COMMAND_CENTER_ROUTES.length);
  });
});
