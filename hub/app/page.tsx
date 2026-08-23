import { listEvents, type WokiEvent } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const CLOSED_STATES = new Set(["RESUELTA", "CANCELADA"]);

function eventLabel(event: WokiEvent) {
  return event.kind.replace(/^REQUEST_/, "").replaceAll("_", " ");
}

function time(value: string) {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Bogota",
  }).format(new Date(value));
}

function priorityLabel(priority?: number) {
  if (priority === 0) return "Crítica";
  if (priority === 1) return "Alta";
  if (priority === 2) return "Media";
  return "Baja";
}

function markerPosition(index: number) {
  return {
    left: `${18 + ((index * 31) % 68)}%`,
    top: `${21 + ((index * 23) % 57)}%`,
  };
}

export default async function Home() {
  let events: WokiEvent[] = [];
  let error = "";

  try {
    events = await listEvents();
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "Hub no disponible";
  }

  const latestByIncident = new Map<string, WokiEvent>();
  for (const event of events) {
    const request = event.payload.request;
    if (!request?.node || request.seq === undefined) continue;
    const incidentId = `${event.origin_id}:${request.node}:${request.seq}`;
    if (!latestByIncident.has(incidentId)) latestByIncident.set(incidentId, event);
  }

  const incidents = [...latestByIncident.entries()]
    .map(([id, event]) => ({ id, event, request: event.payload.request ?? {} }))
    .sort((a, b) => {
      const priority = (a.request.priority ?? 3) - (b.request.priority ?? 3);
      return priority || Date.parse(b.event.occurred_at) - Date.parse(a.event.occurred_at);
    });
  const operations = new Set(events.map((event) => event.operation_id)).size;
  const active = incidents.filter(({ request }) => !CLOSED_STATES.has(request.state ?? "")).length;
  const critical = incidents.filter(({ request }) => request.priority === 0).length;

  return (
    <div className="app-shell">
      <a className="skip-link" href="#content">Ir al contenido</a>

      <aside className="sidebar">
        <div className="brand" aria-label="Centro LoRa">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-label">Centro LoRa</span>
        </div>

        <nav aria-label="Navegación principal">
          <a href="#overview" aria-current="page">
            <span className="nav-icon" aria-hidden="true">◉</span>
            <span className="nav-label">Overview</span>
          </a>
          <a href="#requests">
            <span className="nav-icon" aria-hidden="true">!</span>
            <span className="nav-label">Solicitudes</span>
          </a>
          <a href="/setup">
            <span className="nav-icon" aria-hidden="true">＋</span>
            <span className="nav-label">Preparar kit</span>
          </a>
          <span className="nav-disabled" aria-disabled="true"><span className="nav-icon" aria-hidden="true">R</span><span className="nav-label">Recursos</span></span>
          <span className="nav-disabled" aria-disabled="true"><span className="nav-icon" aria-hidden="true">≋</span><span className="nav-label">Red LoRa</span></span>
          <span className="nav-disabled" aria-disabled="true"><span className="nav-icon" aria-hidden="true">↗</span><span className="nav-label">Broadcasts</span></span>
          <span className="nav-disabled" aria-disabled="true"><span className="nav-icon" aria-hidden="true">✓</span><span className="nav-label">Personas a salvo</span></span>
        </nav>

        <div className="sidebar-footer">
          <span className={`status-dot ${error ? "" : "connected"}`} aria-hidden="true" />
          <span>{error ? "Réplica sin conexión" : "Réplica conectada"}</span>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div><p className="eyebrow">Réplica online</p><h1>Overview</h1></div>
          <div className="topbar-status">
            <span className="badge">Solo lectura</span>
            <span className={`badge ${error ? "critical" : "success"}`}>{error ? "Sin conexión" : "Sincronizado"}</span>
          </div>
        </header>

        <main id="content">
          <section id="overview" aria-labelledby="overview-title">
            <div className="page-head">
              <div>
                <h2 id="overview-title">Situación operacional</h2>
                <p>La operación ocurre offline; esta vista refleja lo sincronizado al recuperar internet.</p>
              </div>
              <div className="page-head-actions"><span className="badge action">WOKI Hub</span></div>
            </div>

            <div className="metrics" aria-label="Resumen operacional">
              <article className="metric"><strong>{incidents.length}</strong><span>Solicitudes replicadas</span></article>
              <article className="metric"><strong>{active}</strong><span>Solicitudes abiertas</span></article>
              <article className="metric"><strong>{critical}</strong><span>Prioridad crítica</span></article>
              <article className="metric"><strong>{operations}</strong><span>Operaciones</span></article>
            </div>

            {error ? (
              <section className="panel empty-state" aria-live="polite"><strong>Hub temporalmente no disponible</strong><span>{error}</span></section>
            ) : (
              <div className="grid">
                <section className="panel map-panel" aria-labelledby="map-title">
                  <div className="panel-head">
                    <div><h3 id="map-title">Mapa operacional</h3><span className="panel-subtitle">Vista anonimizada de lo sincronizado</span></div>
                    <div className="panel-actions"><span className="badge success">Réplica</span></div>
                  </div>
                  <div className="map" aria-label="Esquema de solicitudes replicadas">
                    <span className="schematic-context" aria-hidden="true">N<i /></span>
                    <span className="map-dot center" style={{ left: "50%", top: "50%" }} aria-hidden="true" />
                    {incidents.slice(0, 12).map(({ id, request }, index) => (
                      <span className={`map-dot request ${request.priority === 0 ? "critical-new" : ""}`} key={id} style={markerPosition(index)} title={`${request.category ?? "Solicitud"} · ${priorityLabel(request.priority)}`} />
                    ))}
                    {incidents.length === 0 && <div className="map-empty">Esperando la primera sincronización</div>}
                    <span className="map-note">Sin coordenadas exactas por privacidad</span>
                  </div>
                  <div className="map-legend" aria-label="Leyenda">
                    <span><i className="legend-shape center" /> Centro</span>
                    <span><i className="legend-shape request" /> Solicitud replicada</span>
                  </div>
                </section>

                <section className="panel" id="requests" aria-labelledby="requests-title">
                  <div className="panel-head">
                    <div><h3 id="requests-title">Cola priorizada</h3><span className="panel-subtitle">Estado recibido del Centro</span></div>
                    <span className="badge">{active} abiertas</span>
                  </div>
                  {incidents.length === 0 ? <div className="empty">Sin solicitudes sincronizadas.</div> : (
                    <div className="list">
                      {incidents.slice(0, 8).map(({ id, event, request }) => (
                        <article className="list-item" key={id}>
                          <div className="list-line">
                            <strong>{request.category ?? "SOLICITUD"}</strong>
                            <span className={`badge priority-${request.priority ?? 3}`}>{priorityLabel(request.priority)}</span>
                          </div>
                          <div className="cell-sub">{request.node ?? "Nodo"} · {request.state ?? "REGISTRADA"} · {time(event.occurred_at)}</div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}

            {!error && (
              <section className="panel activity-panel" aria-labelledby="activity-title">
                <div className="panel-head">
                  <div><h3 id="activity-title">Actividad sincronizada</h3><span className="panel-subtitle">Trazabilidad recibida desde los centros offline</span></div>
                  <span className="badge">{events.length} eventos</span>
                </div>
                {events.length === 0 ? <div className="empty">El Centro local puede seguir operando sin internet.</div> : (
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Evento</th><th>Solicitud</th><th>Estado</th><th>Origen</th><th>Hora</th></tr></thead>
                      <tbody>
                        {events.slice(0, 12).map((event) => {
                          const request = event.payload.request ?? {};
                          return (
                            <tr key={event.event_id}>
                              <td><span className="activity-code">{eventLabel(event)}</span></td>
                              <td><span className="cell-main">{request.category ?? "OPERACIÓN"}</span><div className="cell-sub">{request.node ?? "—"}</div></td>
                              <td><span className="badge">{request.state ?? "REGISTRADO"}</span></td>
                              <td><span className="mono short-id">{event.origin_id}</span></td>
                              <td><time className="mono" dateTime={event.occurred_at}>{time(event.occurred_at)}</time></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            <p className="read-only-note">La réplica nunca autoriza ni ejecuta asignaciones críticas.</p>
          </section>
        </main>
      </div>
    </div>
  );
}
