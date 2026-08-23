import type { Metadata } from "next";

import { CommandCenterSidebar } from "@/components/CommandCenterSidebar";
import { OperationalMap, type OperationalMapPoint } from "@/components/OperationalMap";
import { ReplicaRefresh } from "@/components/ReplicaRefresh";
import { buildReplica } from "@/lib/replica";
import { listEvents, type WokiEvent } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Centro de Comando | WOKI",
  description: "Réplica online de solo lectura del Centro LoRa WOKI.",
};

function time(value?: string | number) {
  if (value === undefined) return "—";
  const date = typeof value === "number" ? new Date(value * 1000) : new Date(value);
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Bogota",
  }).format(date);
}

function priorityLabel(priority?: number) {
  if (priority === 0) return "Crítica";
  if (priority === 1) return "Alta";
  if (priority === 2) return "Media";
  return "Baja";
}

function eventLabel(event: WokiEvent) {
  return event.kind.replace(/^REQUEST_/, "").replaceAll("_", " ");
}

export default async function CommandCenterPage() {
  let events: WokiEvent[] = [];
  let error = "";
  try {
    events = await listEvents(200);
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "Hub no disponible";
  }

  const replica = buildReplica(events);
  const points: OperationalMapPoint[] = [
    ...replica.centers.flatMap((center) => center.mapPoint ? [{ id: center.id, ...center.mapPoint, kind: "center" as const, label: center.label }] : []),
    ...replica.incidents.flatMap((incident) => incident.mapPoint ? [{ id: incident.id, ...incident.mapPoint, kind: "request" as const, label: `${incident.request.category ?? "Solicitud"} · ${priorityLabel(incident.request.priority)}`, critical: incident.request.priority === 0 }] : []),
    ...replica.resources.flatMap((item) => item.mapPoint ? [{ id: item.id, ...item.mapPoint, kind: "resource" as const, label: `${item.resource.node} · ${item.resource.state ?? "sin estado"}` }] : []),
    ...replica.safePeople.flatMap((item) => item.mapPoint ? [{ id: item.id, ...item.mapPoint, kind: "safe" as const, label: `A salvo · ${item.person.place || "ubicación reportada"}` }] : []),
  ];

  return (
    <div className="app-shell">
      <a className="skip-link" href="#content">Ir al contenido</a>
      <CommandCenterSidebar connected={!error} />
      <ReplicaRefresh />

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
              <div><h2 id="overview-title">Situación operacional</h2><p>Vista online de la última información enviada por el Centro local.</p></div>
              <div className="page-head-actions"><span className="badge action">Actualiza cada 15 s</span></div>
            </div>

            <div className="metrics" aria-label="Resumen operacional">
              <article className="metric"><strong>{replica.criticalIncidents}</strong><span>Solicitudes críticas</span></article>
              <article className="metric"><strong>{replica.activeIncidents}</strong><span>Solicitudes abiertas</span></article>
              <article className="metric"><strong>{replica.availableResources}</strong><span>Recursos disponibles</span></article>
              <article className="metric"><strong>{replica.safePeople.length}</strong><span>Personas a salvo</span></article>
            </div>

            {error ? (
              <section className="panel empty-state" aria-live="polite"><strong>Réplica temporalmente no disponible</strong><span>{error}</span></section>
            ) : (
              <div className="grid">
                <section className="panel map-panel" aria-labelledby="map-title">
                  <div className="panel-head"><div><h3 id="map-title">Mapa operacional</h3><span className="panel-subtitle">Mapa real · información minimizada del Centro</span></div><span className="badge success">Réplica</span></div>
                  <OperationalMap points={points} />
                  <div className="map-legend" aria-label="Leyenda"><span><i className="legend-shape center" /> Centro</span><span><i className="legend-shape request" /> Solicitud</span><span><i className="legend-shape resource" /> Recurso</span><span><i className="legend-shape safe" /> A salvo</span></div>
                </section>

                <section className="panel" id="requests" aria-labelledby="requests-title">
                  <div className="panel-head"><div><h3 id="requests-title">Solicitudes</h3><span className="panel-subtitle">Cola priorizada recibida</span></div><span className="badge">{replica.activeIncidents} abiertas</span></div>
                  {replica.incidents.length === 0 ? <div className="empty">Sin solicitudes sincronizadas.</div> : <div className="list">{replica.incidents.slice(0, 8).map(({ id, event, request }) => (
                    <article className="list-item" key={id}><div className="list-line"><strong>{request.category ?? "SOLICITUD"}</strong><span className={`badge priority-${request.priority ?? 3}`}>{priorityLabel(request.priority)}</span></div><div className="cell-sub">{request.place || request.node || "Nodo"} · {request.state ?? "REGISTRADA"} · {time(event.occurred_at)}</div></article>
                  ))}</div>}
                </section>
              </div>
            )}

            {!error && <>
              <div className="grid detail-grid">
                <section className="panel" id="resources" aria-labelledby="resources-title">
                  <div className="panel-head"><div><h3 id="resources-title">Recursos</h3><span className="panel-subtitle">Último estado reportado por LoRa</span></div><span className="badge">{replica.resources.length}</span></div>
                  {replica.resources.length === 0 ? <div className="empty">Sin recursos sincronizados.</div> : <div className="list">{replica.resources.slice(0, 8).map(({ id, event, resource }) => (
                    <article className="list-item" key={id}><div className="list-line"><strong className="mono">{resource.node}</strong><span className={`badge ${resource.state === "disponible" ? "success" : ""}`}>{resource.state ?? "sin estado"}</span></div><div className="cell-sub">{resource.kind || "RECURSO"} · {resource.zone || "SIN ZONA"} · visto {time(resource.last_seen ?? event.occurred_at)}</div></article>
                  ))}</div>}
                </section>

                <section className="panel" id="network" aria-labelledby="network-title">
                  <div className="panel-head"><div><h3 id="network-title">Red LoRa</h3><span className="panel-subtitle">Salud de la réplica</span></div><span className={`badge ${events.length ? "success" : ""}`}>{replica.operations} operación{replica.operations === 1 ? "" : "es"}</span></div>
                  <dl className="key-values compact"><dt>Centros</dt><dd>{replica.centers.length || new Set(events.map((event) => event.origin_id)).size}</dd><dt>Última recepción</dt><dd>{time(replica.lastReceivedAt)}</dd><dt>Eventos</dt><dd>{events.length}</dd><dt>Transporte</dt><dd>HTTPS · cola persistente</dd></dl>
                </section>
              </div>

              <div className="grid detail-grid">
                <section className="panel" id="broadcasts" aria-labelledby="broadcasts-title">
                  <div className="panel-head"><div><h3 id="broadcasts-title">Broadcasts</h3><span className="panel-subtitle">Mensajes y recibos técnicos</span></div><span className="badge">{replica.broadcasts.length}</span></div>
                  {replica.broadcasts.length === 0 ? <div className="empty">Sin broadcasts sincronizados.</div> : <div className="list">{replica.broadcasts.slice(0, 6).map(({ id, broadcast, receipts: nodes }) => (
                    <article className="list-item" key={id}><div className="list-line"><strong>{broadcast.message || `Broadcast #${broadcast.message_id}`}</strong><span className={`badge ${broadcast.status === "SENT" ? "success" : broadcast.status === "FAILED" ? "critical" : "warning"}`}>{broadcast.status ?? "REGISTRADO"}</span></div><div className="cell-sub">{broadcast.scope || "TODOS"} · {nodes.length} recibo{nodes.length === 1 ? "" : "s"}</div></article>
                  ))}</div>}
                </section>

                <section className="panel" id="safe-people" aria-labelledby="safe-title">
                  <div className="panel-head"><div><h3 id="safe-title">Personas a salvo</h3><span className="panel-subtitle">Registro anonimizado</span></div><span className="badge success">{replica.safePeople.length}</span></div>
                  {replica.safePeople.length === 0 ? <div className="empty">Sin reportes sincronizados.</div> : <div className="list">{replica.safePeople.slice(0, 6).map(({ id, event, person }) => (
                    <article className="list-item" key={id}><div className="list-line"><strong>Reporte confirmado</strong><span className="badge success">A salvo</span></div><div className="cell-sub">{person.place || "Ubicación protegida"} · {time(person.created_at ?? event.occurred_at)}</div></article>
                  ))}</div>}
                </section>
              </div>

              <section className="panel activity-panel" aria-labelledby="activity-title">
                <div className="panel-head"><div><h3 id="activity-title">Actividad sincronizada</h3><span className="panel-subtitle">Trazabilidad recibida desde el Centro offline</span></div><span className="badge">{events.length} eventos</span></div>
                {events.length === 0 ? <div className="empty">El Centro local puede seguir operando sin internet.</div> : <div className="table-wrap"><table><thead><tr><th>Evento</th><th>Elemento</th><th>Origen</th><th>Recibido</th></tr></thead><tbody>{events.slice(0, 15).map((event) => (
                  <tr key={event.event_id}><td><span className="activity-code">{eventLabel(event)}</span></td><td><span className="cell-main">{event.payload.request?.category ?? event.payload.resource?.node ?? event.payload.center?.label ?? event.payload.safe_person?.place ?? event.payload.broadcast?.message ?? "OPERACIÓN"}</span></td><td><span className="mono short-id">{event.origin_id}</span></td><td><time className="mono" dateTime={event.received_at}>{time(event.received_at)}</time></td></tr>
                ))}</tbody></table></div>}
              </section>
            </>}

            <p className="read-only-note">Las asignaciones se autorizan únicamente en el Centro local. Esta réplica no controla las radios.</p>
          </section>
        </main>
      </div>
    </div>
  );
}
