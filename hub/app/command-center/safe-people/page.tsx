import type { Metadata } from "next";

import { formatEventTime, loadCommandCenterReplica } from "@/lib/command-center";

export const metadata: Metadata = { title: "Personas a salvo | WOKI" };

export default async function SafePeoplePage() {
  const { error, replica } = await loadCommandCenterReplica();
  return (
    <section aria-labelledby="safe-title">
      <div className="page-head"><div><h2 id="safe-title">Personas a salvo</h2><p>Confirmaciones anonimizadas recibidas desde los nodos afectados.</p></div><span className="badge success">{replica.safePeople.length} reportes</span></div>
      <section className="privacy-banner"><strong>Privacidad protegida</strong><span>La réplica online no recibe nombres ni documentos; el detalle permanece en la base local.</span></section>
      <section className="panel">
        {error ? <div className="empty">No se pudo leer la réplica: {error}</div> : replica.safePeople.length === 0 ? <div className="empty"><strong>Nadie se ha reportado a salvo todavía.</strong><span>Los nuevos reportes aparecerán aquí después de sincronizar.</span></div> : (
          <div className="table-wrap"><table><thead><tr><th>Estado</th><th>Lugar</th><th>Nodo</th><th>Ubicación</th><th>Reportado</th></tr></thead><tbody>{replica.safePeople.map(({ id, event, person, mapPoint }) => (
            <tr key={id}><td><span className="badge success">✓ A salvo</span></td><td><span className="cell-main">{person.place || "Ubicación protegida"}</span></td><td className="mono">{person.node}</td><td className="mono">{mapPoint ? `${mapPoint.lat}, ${mapPoint.lon} aprox.` : "Protegida"}</td><td>{formatEventTime(person.created_at ?? event.occurred_at)}</td></tr>
          ))}</tbody></table></div>
        )}
      </section>
    </section>
  );
}
