export function GET() {
  const configured = Boolean(
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.WOKI_SYNC_TOKEN,
  );
  return Response.json({ ok: configured, mode: "read-only-replica" }, { status: configured ? 200 : 503 });
}
