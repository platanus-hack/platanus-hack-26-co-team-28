import { describe, expect, test } from "bun:test";

import { buildReplica } from "./replica";
import type { WokiEvent } from "./supabase";

function event(sequence: number, kind: string, payload: WokiEvent["payload"]): WokiEvent {
  return {
    event_id: `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
    operation_id: "10000000-0000-4000-8000-000000000001",
    origin_id: "center-bogota",
    sequence,
    kind,
    occurred_at: `2026-08-23T12:00:${String(sequence).padStart(2, "0")}.000Z`,
    received_at: `2026-08-23T12:00:${String(sequence).padStart(2, "0")}.500Z`,
    payload,
    schema_version: 1,
  };
}

describe("réplica operacional", () => {
  test("conserva la versión más reciente de solicitudes, recursos y Centro", () => {
    const replica = buildReplica([
      event(1, "REQUEST_INGESTED", { request: { node: "CIVIL1", seq: 7, priority: 0, state: "PENDIENTE" }, map_point: { lat: 4.68, lon: -74.05 } }),
      event(2, "RESOURCE_UPDATED", { resource: { node: "GRUA07", state: "disponible", kind: "GRUA" }, map_point: { lat: 4.681, lon: -74.052 } }),
      event(3, "REQUEST_DISPATCHED", { request: { node: "CIVIL1", seq: 7, priority: 0, state: "DESPACHADA", resource_node: "GRUA07" }, map_point: { lat: 4.68, lon: -74.05 } }),
      event(4, "CENTER_POSITION_UPDATED", { center: { label: "Puesto Norte" }, map_point: { lat: 4.682, lon: -74.051 } }),
    ]);

    expect(replica.incidents).toHaveLength(1);
    expect(replica.incidents[0].request.state).toBe("DESPACHADA");
    expect(replica.resources[0].mapPoint).toEqual({ lat: 4.681, lon: -74.052 });
    expect(replica.centers[0].label).toBe("Puesto Norte");
    expect(replica.criticalIncidents).toBe(1);
    expect(replica.availableResources).toBe(1);
  });

  test("agrupa recibos y personas a salvo sin requerir datos personales", () => {
    const replica = buildReplica([
      event(5, "SAFE_PERSON_REPORTED", { safe_person: { node: "CIVIL2", seq: 8, place: "Parque" }, map_point: { lat: 4.7, lon: -74.08 } }),
      event(6, "BROADCAST_CREATED", { broadcast: { message_id: 3, message: "Evacuar", status: "SENDING" } }),
      event(7, "BROADCAST_SENT", { broadcast: { message_id: 3, message: "Evacuar", status: "SENT" } }),
      event(8, "BROADCAST_RECEIPT", { broadcast_receipt: { broadcast_id: 3, node: "GRUA07" } }),
    ]);

    expect(replica.safePeople[0].person).toEqual({ node: "CIVIL2", seq: 8, place: "Parque" });
    expect(replica.broadcasts).toHaveLength(1);
    expect(replica.broadcasts[0].broadcast.status).toBe("SENT");
    expect(replica.broadcasts[0].receipts).toEqual(["GRUA07"]);
  });
});
