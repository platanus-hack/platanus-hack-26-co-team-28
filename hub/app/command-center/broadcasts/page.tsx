import type { Metadata } from "next";

import { formatEventTime, loadCommandCenterReplica } from "@/lib/command-center";

export const metadata: Metadata = { title: "Broadcasts | WOKI" };

export default async function BroadcastsPage() {
  const { error, replica } = await loadCommandCenterReplica();
  return (
    <section aria-labelledby="broadcasts-title">
      <div className="page-head"><div><h2 id="broadcasts-title">Broadcasts</h2><p>Mensajes enviados por el Centro y recibos técnicos de los nodos.</p></div><span className="badge">{replica.broadcasts.length} mensajes</span></div>
      <section className="readonly-banner"><strong>Monitoreo online</strong><span>La composición y transmisión siguen ocurriendo únicamente desde el Centro local.</span></section>
      <section className="panel">
        {error ? <div className="empty">No se pudo leer la réplica: {error}</div> : replica.broadcasts.length === 0 ? <div className="empty"><strong>Aún no hay broadcasts sincronizados.</strong><span>Cuando el Centro envíe uno, aparecerán aquí su estado y confirmaciones.</span></div> : (
          <div className="list">{replica.broadcasts.map(({ id, event, broadcast, receipts }) => (
            <article className="list-item broadcast-item" key={id}><div><div className="list-line"><strong>{broadcast.message || `Broadcast #${broadcast.message_id}`}</strong><span className={`badge ${broadcast.status === "SENT" ? "success" : broadcast.status === "FAILED" ? "critical" : "warning"}`}>{broadcast.status ?? "REGISTRADO"}</span></div><div className="cell-sub">{broadcast.scope || "TODOS"} · prioridad {broadcast.priority || "normal"} · {formatEventTime(broadcast.created_at ?? event.occurred_at)}</div></div><div className="receipt-list"><span>{receipts.length} recibo{receipts.length === 1 ? "" : "s"}</span>{receipts.map((node) => <code key={node}>{node}</code>)}</div></article>
          ))}</div>
        )}
      </section>
    </section>
  );
}
