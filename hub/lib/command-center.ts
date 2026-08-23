import { cache } from "react";

import type { OperationalMapPoint } from "@/components/OperationalMap";

import { buildReplica } from "./replica";
import { listEvents, type WokiEvent } from "./supabase";

export const loadCommandCenterReplica = cache(async () => {
  let events: WokiEvent[] = [];
  let error = "";
  try {
    events = await listEvents(200);
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "Hub no disponible";
  }
  return { events, error, replica: buildReplica(events) };
});

export function formatEventTime(value?: string | number) {
  if (value === undefined) return "—";
  const date = typeof value === "number" ? new Date(value * 1000) : new Date(value);
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Bogota",
  }).format(date);
}

export function priorityLabel(priority?: number) {
  if (priority === 0) return "Crítica";
  if (priority === 1) return "Alta";
  if (priority === 2) return "Media";
  return "Baja";
}

export function eventLabel(event: WokiEvent) {
  return event.kind.replace(/^REQUEST_/, "").replaceAll("_", " ");
}

export function operationalMapPoints(replica: ReturnType<typeof buildReplica>): OperationalMapPoint[] {
  return [
    ...replica.centers.flatMap((center) => center.mapPoint ? [{ id: center.id, ...center.mapPoint, kind: "center" as const, label: center.label }] : []),
    ...replica.incidents.flatMap((incident) => incident.mapPoint ? [{ id: incident.id, ...incident.mapPoint, kind: "request" as const, label: `${incident.request.category ?? "Solicitud"} · ${priorityLabel(incident.request.priority)}`, critical: incident.request.priority === 0 }] : []),
    ...replica.resources.flatMap((item) => item.mapPoint ? [{ id: item.id, ...item.mapPoint, kind: "resource" as const, label: `${item.resource.node} · ${item.resource.state ?? "sin estado"}` }] : []),
    ...replica.safePeople.flatMap((item) => item.mapPoint ? [{ id: item.id, ...item.mapPoint, kind: "safe" as const, label: `A salvo · ${item.person.place || "ubicación reportada"}` }] : []),
  ];
}
