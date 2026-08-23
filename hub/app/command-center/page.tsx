import Link from "next/link";
import type { Metadata } from "next";

import { OperationalMap } from "@/components/OperationalMap";
import { formatEventTime, loadCommandCenterReplica, operationalMapPoints, priorityLabel } from "@/lib/command-center";

export const metadata: Metadata = {
  title: "Centro de Comando | WOKI",
  description: "Réplica online de solo lectura del Centro LoRa WOKI.",
};

export default async function CommandCenterPage() {
  const { error, replica } = await loadCommandCenterReplica();
  const points = operationalMapPoints(replica);

  return (
    <section aria-labelledby="overview-title">
      <div className="page-head">
        <div><h2 id="overview-title">Situación operacional</h2><p>Decisiones pendientes y último estado sincronizado del Centro local.</p></div>
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

          <section className="panel" aria-labelledby="queue-title">
            <div className="panel-head"><div><h3 id="queue-title">Cola priorizada</h3><span className="panel-subtitle">Estado recibido del Centro</span></div><Link className="button" href="/command-center/requests">Ver todas</Link></div>
            {replica.incidents.length === 0 ? <div className="empty">Sin solicitudes sincronizadas.</div> : <div className="list">{replica.incidents.slice(0, 8).map(({ id, event, request }) => (
              <article className="list-item" key={id}><div className="list-line"><strong>{request.category ?? "SOLICITUD"}</strong><span className={`badge priority-${request.priority ?? 3}`}>{priorityLabel(request.priority)}</span></div><div className="cell-sub">{request.place || request.node || "Nodo"} · {request.state ?? "REGISTRADA"} · {formatEventTime(event.occurred_at)}</div></article>
            ))}</div>}
          </section>
        </div>
      )}

      {!error && (
        <section className="panel activity-panel" aria-labelledby="modules-title">
          <div className="panel-head"><div><h3 id="modules-title">Módulos operacionales</h3><span className="panel-subtitle">Cada módulo refleja únicamente datos sincronizados</span></div></div>
          <div className="module-grid">
            <Link href="/command-center/resources"><strong>Recursos</strong><span>{replica.resources.length} registrados</span></Link>
            <Link href="/command-center/network"><strong>Red LoRa</strong><span>{replica.events.length} eventos</span></Link>
            <Link href="/command-center/broadcasts"><strong>Broadcasts</strong><span>{replica.broadcasts.length} mensajes</span></Link>
            <Link href="/command-center/safe-people"><strong>Personas a salvo</strong><span>{replica.safePeople.length} reportes</span></Link>
          </div>
        </section>
      )}
    </section>
  );
}
