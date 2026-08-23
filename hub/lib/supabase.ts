export type WokiEvent = {
  event_id: string;
  operation_id: string;
  origin_id: string;
  sequence: number;
  kind: string;
  occurred_at: string;
  received_at: string;
  payload: {
    request?: {
      node?: string;
      seq?: number;
      category?: string;
      priority?: number;
      state?: string;
      resource_node?: string | null;
    };
    transition?: { from?: string | null; to?: string | null; actor?: string };
  };
  schema_version: number;
};

export type IngestEvent = Omit<WokiEvent, "received_at">;

function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Hub no configurado");
  return { url, key };
}

async function request(path: string, init?: RequestInit) {
  const { url, key } = config();
  const response = await fetch(url + path, {
    ...init,
    cache: "no-store",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`Supabase ${response.status}: ${detail}`);
  }
  return response;
}

export async function ingestEvent(event: IngestEvent): Promise<void> {
  await request("/rest/v1/rpc/woki_ingest_event", {
    method: "POST",
    body: JSON.stringify({
      p_event_id: event.event_id,
      p_operation_id: event.operation_id,
      p_origin_id: event.origin_id,
      p_sequence: event.sequence,
      p_kind: event.kind,
      p_occurred_at: event.occurred_at,
      p_payload: event.payload,
      p_schema_version: event.schema_version,
    }),
  });
}

export async function listEvents(limit = 100): Promise<WokiEvent[]> {
  const columns = "event_id,operation_id,origin_id,sequence,kind,occurred_at,received_at,payload,schema_version";
  const response = await request(
    `/rest/v1/woki_events?select=${columns}&order=occurred_at.desc,sequence.desc&limit=${Math.min(limit, 200)}`,
  );
  return (await response.json()) as WokiEvent[];
}
