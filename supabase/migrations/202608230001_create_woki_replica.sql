-- WOKI online replica. The offline command center remains the operational authority.
-- Existing tables from the previous project are intentionally left untouched.

create table if not exists public.woki_operations (
  id uuid primary key,
  name text not null,
  status text not null default 'active'
    check (status in ('active', 'closed', 'archived')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at)
);

create table if not exists public.woki_origins (
  id text primary key,
  label text not null default '',
  last_sequence bigint not null default 0 check (last_sequence >= 0),
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.woki_events (
  event_id uuid primary key,
  operation_id uuid not null references public.woki_operations(id) on delete restrict,
  origin_id text not null references public.woki_origins(id) on delete restrict,
  sequence bigint not null check (sequence > 0),
  kind text not null check (kind ~ '^[A-Z][A-Z0-9_]{0,63}$'),
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  schema_version integer not null default 1 check (schema_version > 0),
  unique (origin_id, sequence)
);

create index if not exists woki_events_operation_occurred
  on public.woki_events(operation_id, occurred_at desc, sequence desc);
create index if not exists woki_events_kind_occurred
  on public.woki_events(kind, occurred_at desc);

alter table public.woki_operations enable row level security;
alter table public.woki_origins enable row level security;
alter table public.woki_events enable row level security;

-- No anon/authenticated policies are created. Runtime access goes through the
-- Vercel ingestion/API layer using a server-only service-role credential.
revoke all on public.woki_operations from anon, authenticated;
revoke all on public.woki_origins from anon, authenticated;
revoke all on public.woki_events from anon, authenticated;

create or replace function public.woki_ingest_event(
  p_event_id uuid,
  p_operation_id uuid,
  p_origin_id text,
  p_sequence bigint,
  p_kind text,
  p_occurred_at timestamptz,
  p_payload jsonb default '{}'::jsonb,
  p_schema_version integer default 1
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count integer;
begin
  if p_origin_id is null or length(p_origin_id) not between 1 and 80 then
    raise exception 'invalid origin_id';
  end if;
  if p_sequence is null or p_sequence < 1 then
    raise exception 'invalid sequence';
  end if;
  if p_kind is null or p_kind !~ '^[A-Z][A-Z0-9_]{0,63}$' then
    raise exception 'invalid kind';
  end if;
  if p_schema_version is null or p_schema_version < 1 then
    raise exception 'invalid schema_version';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' or pg_column_size(p_payload) > 65536 then
    raise exception 'invalid payload';
  end if;

  insert into public.woki_operations(id, name)
  values (p_operation_id, 'Operación ' || left(p_operation_id::text, 8))
  on conflict (id) do nothing;

  insert into public.woki_origins(id, last_sequence, last_seen_at)
  values (p_origin_id, p_sequence, now())
  on conflict (id) do update
    set last_sequence = greatest(public.woki_origins.last_sequence, excluded.last_sequence),
        last_seen_at = excluded.last_seen_at;

  insert into public.woki_events(
    event_id, operation_id, origin_id, sequence, kind,
    occurred_at, payload, schema_version
  ) values (
    p_event_id, p_operation_id, p_origin_id, p_sequence, p_kind,
    p_occurred_at, p_payload, p_schema_version
  )
  on conflict (event_id) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count = 1;
end;
$$;

revoke all on function public.woki_ingest_event(
  uuid, uuid, text, bigint, text, timestamptz, jsonb, integer
) from public, anon, authenticated;
grant execute on function public.woki_ingest_event(
  uuid, uuid, text, bigint, text, timestamptz, jsonb, integer
) to service_role;

comment on table public.woki_events is
  'Idempotent read-only online replica of operational events produced by offline WOKI centers.';
comment on function public.woki_ingest_event is
  'Server-only idempotent ingestion boundary. Returns true only for a newly inserted event.';
