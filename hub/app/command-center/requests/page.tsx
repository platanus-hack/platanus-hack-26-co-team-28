import type { Metadata } from "next";

import { formatEventTime, loadCommandCenterReplica, priorityLabel } from "@/lib/command-center";

export const metadata: Metadata = { title: "Solicitudes | WOKI" };

type Filters = { q?: string | string[]; state?: string | string[]; category?: string | string[]; priority?: string | string[] };
const STATES = ["PENDIENTE", "EN_REVISION", "ENVIO_INDETERMINADO", "DESPACHADA", "ACEPTADA", "EN_CURSO", "RESUELTA", "CANCELADA"];
const CATEGORIES = ["MEDICO", "RESCATE", "GRUA", "AGUA", "FUEGO"];

function value(input?: string | string[]) { return Array.isArray(input) ? input[0] ?? "" : input ?? ""; }

export default async function RequestsPage({ searchParams }: { searchParams: Promise<Filters> }) {
  const { error, replica } = await loadCommandCenterReplica();
  const params = await searchParams;
  const q = value(params.q).trim().toLowerCase();
  const state = value(params.state);
  const category = value(params.category);
  const priority = value(params.priority);
  const incidents = replica.incidents.filter(({ request }) => {
    const text = `${request.node ?? ""} ${request.place ?? ""} ${request.category ?? ""}`.toLowerCase();
    return (!q || text.includes(q)) && (!state || request.state === state) && (!category || request.category === category) && (!priority || String(request.priority) === priority);
  });

  return (
    <section aria-labelledby="requests-title">
      <div className="page-head"><div><h2 id="requests-title">Solicitudes</h2><p>Triage, estado y asignaciones observadas en el Centro local.</p></div><span className="badge">{incidents.length} resultados</span></div>
      <form className="filters" method="get">
        <label>Buscar<input name="q" defaultValue={value(params.q)} placeholder="Nodo, lugar o categoría" /></label>
        <label>Estado<select name="state" defaultValue={state}><option value="">Todos</option>{STATES.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Categoría<select name="category" defaultValue={category}><option value="">Todas</option>{CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Prioridad<select name="priority" defaultValue={priority}><option value="">Todas</option><option value="0">Crítica</option><option value="1">Alta</option><option value="2">Media</option><option value="3">Baja</option></select></label>
        <button className="button dark" type="submit">Aplicar filtros</button>
      </form>
      <section className="panel">
        {error ? <div className="empty">No se pudo leer la réplica: {error}</div> : incidents.length === 0 ? <div className="empty">No hay solicitudes con estos filtros.</div> : (
          <div className="table-wrap"><table><thead><tr><th>Solicitud</th><th>Prioridad</th><th>Estado</th><th>Asignación</th><th>Ingreso</th></tr></thead><tbody>{incidents.map(({ id, event, request }) => (
            <tr key={id}><td><span className="cell-main">{request.category ?? "SOLICITUD"}</span><div className="cell-sub">{request.place || request.node || "Sin lugar"}</div></td><td><span className={`badge priority-${request.priority ?? 3}`}>{priorityLabel(request.priority)}</span></td><td><span className="badge">{request.state ?? "REGISTRADA"}</span></td><td className="mono">{request.resource_node || "Sin asignar"}</td><td>{formatEventTime(request.created_at ?? event.occurred_at)}</td></tr>
          ))}</tbody></table></div>
        )}
      </section>
    </section>
  );
}
