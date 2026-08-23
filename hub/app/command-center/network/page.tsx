import type { Metadata } from "next";

import { eventLabel, formatEventTime, loadCommandCenterReplica } from "@/lib/command-center";

export const metadata: Metadata = { title: "Red LoRa | WOKI" };

export default async function NetworkPage() {
  const { error, events, replica } = await loadCommandCenterReplica();
  const origins = new Set(events.map((event) => event.origin_id)).size;
  const lastSequence = events.reduce((highest, event) => Math.max(highest, event.sequence), 0);
  return (
    <section aria-labelledby="network-title">
      <div className="page-head"><div><h2 id="network-title">Red LoRa</h2><p>Trazabilidad recibida desde gateways y nodos del Centro local.</p></div><span className={`badge ${error ? "critical" : "success"}`}>{error ? "Sin conexión" : "Réplica conectada"}</span></div>
      <div className="metrics"><article className="metric"><strong>{origins}</strong><span>Centros observados</span></article><article className="metric"><strong>{replica.resources.length}</strong><span>Recursos reportados</span></article><article className="metric"><strong>{events.length}</strong><span>Eventos recibidos</span></article><article className="metric"><strong>{lastSequence}</strong><span>Última secuencia</span></article></div>
      <section className="panel">
        <div className="panel-head"><div><h3>Actividad de red</h3><span className="panel-subtitle">La radio opera localmente; aquí sólo vemos su réplica HTTPS</span></div><span className="badge">Último: {formatEventTime(replica.lastReceivedAt)}</span></div>
        {error ? <div className="empty">No se pudo leer la réplica: {error}</div> : events.length === 0 ? <div className="empty"><strong>Esperando la primera sincronización.</strong><span>El Centro local puede continuar operando sin internet.</span></div> : (
          <div className="table-wrap"><table><thead><tr><th>Secuencia</th><th>Evento</th><th>Origen</th><th>Ocurrió</th><th>Recibido</th></tr></thead><tbody>{events.map((event) => (
            <tr key={event.event_id}><td className="mono">#{event.sequence}</td><td><span className="activity-code">{eventLabel(event)}</span></td><td><span className="mono short-id">{event.origin_id}</span></td><td>{formatEventTime(event.occurred_at)}</td><td>{formatEventTime(event.received_at)}</td></tr>
          ))}</tbody></table></div>
        )}
      </section>
    </section>
  );
}
