import { timingSafeEqual } from "node:crypto";
import { ingestEvent, type IngestEvent } from "@/lib/supabase";

export const runtime = "nodejs";

type Candidate = Record<string, unknown>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KIND = /^[A-Z][A-Z0-9_]{0,63}$/;

function authorized(header: string | null, expected: string): boolean {
  if (!header?.startsWith("Bearer ") || !expected) return false;
  const supplied = Buffer.from(header.slice(7));
  const target = Buffer.from(expected);
  return supplied.length === target.length && timingSafeEqual(supplied, target);
}

function validEvent(value: unknown): value is Candidate {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const event = value as Candidate;
  const payload = event.payload;
  return (
    typeof event.event_id === "string" && UUID.test(event.event_id) &&
    typeof event.operation_id === "string" && UUID.test(event.operation_id) &&
    typeof event.origin_id === "string" && event.origin_id.length >= 1 && event.origin_id.length <= 80 &&
    Number.isSafeInteger(event.sequence) && Number(event.sequence) > 0 &&
    typeof event.kind === "string" && KIND.test(event.kind) &&
    typeof event.occurred_at === "string" && Number.isFinite(Date.parse(event.occurred_at)) &&
    payload !== null && typeof payload === "object" && !Array.isArray(payload) &&
    JSON.stringify(payload).length <= 65536 &&
    Number.isSafeInteger(event.schema_version) && Number(event.schema_version) > 0
  );
}

export async function POST(request: Request) {
  const token = process.env.WOKI_SYNC_TOKEN ?? "";
  if (!token || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ error: "sync not configured" }, { status: 503 });
  }
  if (!authorized(request.headers.get("authorization"), token)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 512_000) return Response.json({ error: "payload too large" }, { status: 413 });
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const events = (body as { events?: unknown })?.events;
  if (!Array.isArray(events) || events.length < 1 || events.length > 50 || !events.every(validEvent)) {
    return Response.json({ error: "invalid events" }, { status: 400 });
  }

  const results = await Promise.allSettled(events.map((event) => ingestEvent(event as IngestEvent)));
  const acceptedEventIds = events.flatMap((event, index) =>
    results[index].status === "fulfilled" ? [String(event.event_id)] : [],
  );

  return Response.json(
    { accepted_event_ids: acceptedEventIds },
    { status: acceptedEventIds.length === events.length ? 200 : 207 },
  );
}
