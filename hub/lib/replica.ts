import type { WokiEvent } from "./supabase";

export type ReplicaIncident = {
  id: string;
  event: WokiEvent;
  request: NonNullable<WokiEvent["payload"]["request"]>;
  mapPoint?: { lat: number; lon: number };
};

export type ReplicaResource = {
  id: string;
  event: WokiEvent;
  resource: NonNullable<WokiEvent["payload"]["resource"]>;
  mapPoint?: { lat: number; lon: number };
};

export type ReplicaSafePerson = {
  id: string;
  event: WokiEvent;
  person: NonNullable<WokiEvent["payload"]["safe_person"]>;
  mapPoint?: { lat: number; lon: number };
};

export type ReplicaBroadcast = {
  id: string;
  event: WokiEvent;
  broadcast: NonNullable<WokiEvent["payload"]["broadcast"]>;
  receipts: string[];
};

export type ReplicaCenter = {
  id: string;
  event: WokiEvent;
  label: string;
  mapPoint?: { lat: number; lon: number };
};

const CLOSED_STATES = new Set(["RESUELTA", "CANCELADA"]);

function newestFirst(a: WokiEvent, b: WokiEvent) {
  const received = Date.parse(b.received_at) - Date.parse(a.received_at);
  return received || b.sequence - a.sequence;
}

function setFirst<T>(map: Map<string, T>, id: string, value: T) {
  if (!map.has(id)) map.set(id, value);
}

export function buildReplica(input: WokiEvent[]) {
  const events = [...input].sort(newestFirst);
  const incidentMap = new Map<string, ReplicaIncident>();
  const resourceMap = new Map<string, ReplicaResource>();
  const safeMap = new Map<string, ReplicaSafePerson>();
  const centerMap = new Map<string, ReplicaCenter>();
  const broadcastMap = new Map<string, ReplicaBroadcast>();
  const receipts = new Map<string, Set<string>>();

  for (const event of events) {
    const request = event.payload.request;
    if (request?.node && request.seq !== undefined) {
      const id = `${event.origin_id}:${request.node}:${request.seq}`;
      setFirst(incidentMap, id, { id, event, request, mapPoint: event.payload.map_point });
    }

    const resource = event.payload.resource;
    if (resource?.node) {
      const id = `${event.origin_id}:${resource.node}`;
      setFirst(resourceMap, id, { id, event, resource, mapPoint: event.payload.map_point });
    }

    const person = event.payload.safe_person;
    if (person?.node && person.seq !== undefined) {
      const id = `${event.origin_id}:${person.node}:${person.seq}`;
      setFirst(safeMap, id, { id, event, person, mapPoint: event.payload.map_point });
    }

    const center = event.payload.center;
    if (center) {
      const id = event.origin_id;
      setFirst(centerMap, id, {
        id,
        event,
        label: center.label || "Centro LoRa",
        mapPoint: event.payload.map_point,
      });
    }

    const receipt = event.payload.broadcast_receipt;
    if (receipt?.broadcast_id !== undefined && receipt.node) {
      const id = `${event.origin_id}:${receipt.broadcast_id}`;
      const nodes = receipts.get(id) ?? new Set<string>();
      nodes.add(receipt.node);
      receipts.set(id, nodes);
    }

    const broadcast = event.payload.broadcast;
    if (broadcast?.message_id !== undefined) {
      const id = `${event.origin_id}:${broadcast.message_id}`;
      setFirst(broadcastMap, id, { id, event, broadcast, receipts: [] });
    }
  }

  const incidents = [...incidentMap.values()].sort((a, b) =>
    (a.request.priority ?? 3) - (b.request.priority ?? 3) || newestFirst(a.event, b.event)
  );
  const resources = [...resourceMap.values()].sort((a, b) =>
    String(a.resource.node).localeCompare(String(b.resource.node))
  );
  const safePeople = [...safeMap.values()].sort((a, b) => newestFirst(a.event, b.event));
  const centers = [...centerMap.values()].sort((a, b) => newestFirst(a.event, b.event));
  const broadcasts = [...broadcastMap.values()]
    .map((item) => ({ ...item, receipts: [...(receipts.get(item.id) ?? [])].sort() }))
    .sort((a, b) => newestFirst(a.event, b.event));

  return {
    events,
    incidents,
    resources,
    safePeople,
    centers,
    broadcasts,
    operations: new Set(events.map((event) => event.operation_id)).size,
    activeIncidents: incidents.filter(({ request }) => !CLOSED_STATES.has(request.state ?? "")).length,
    criticalIncidents: incidents.filter(({ request }) => request.priority === 0).length,
    availableResources: resources.filter(({ resource }) => resource.state === "disponible").length,
    lastReceivedAt: events[0]?.received_at,
  };
}
