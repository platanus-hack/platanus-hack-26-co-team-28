import type { Metadata } from "next";

import { formatEventTime, loadCommandCenterReplica } from "@/lib/command-center";

export const metadata: Metadata = { title: "Recursos | WOKI" };

type Filters = { state?: string | string[]; kind?: string | string[]; zone?: string | string[] };
function value(input?: string | string[]) { return Array.isArray(input) ? input[0] ?? "" : input ?? ""; }

export default async function ResourcesPage({ searchParams }: { searchParams: Promise<Filters> }) {
  const { error, replica } = await loadCommandCenterReplica();
  const params = await searchParams;
  const state = value(params.state);
  const kind = value(params.kind);
  const zone = value(params.zone);
  const kinds = [...new Set(replica.resources.flatMap(({ resource }) => resource.kind ? [resource.kind] : []))].sort();
  const zones = [...new Set(replica.resources.flatMap(({ resource }) => resource.zone ? [resource.zone] : []))].sort();
  const resources = replica.resources.filter(({ resource }) => (!state || resource.state === state) && (!kind || resource.kind === kind) && (!zone || resource.zone === zone));

  return (
    <section aria-labelledby="resources-title">
      <div className="page-head"><div><h2 id="resources-title">Recursos</h2><p>Disponibilidad, ubicación aproximada y contacto reportado por LoRa.</p></div><span className="badge">{resources.length} recursos</span></div>
      <form className="filters compact-filters" method="get">
        <label>Estado<select name="state" defaultValue={state}><option value="">Todos</option><option value="disponible">Disponible</option><option value="reservado">Reservado</option><option value="asignado">Asignado</option><option value="enruta">En ruta</option><option value="enlugar">En lugar</option></select></label>
        <label>Tipo<select name="kind" defaultValue={kind}><option value="">Todos</option>{kinds.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Zona<select name="zone" defaultValue={zone}><option value="">Todas</option>{zones.map((item) => <option key={item}>{item}</option>)}</select></label>
        <button className="button dark" type="submit">Aplicar filtros</button>
      </form>
      <section className="panel">
        {error ? <div className="empty">No se pudo leer la réplica: {error}</div> : resources.length === 0 ? <div className="empty"><strong>Aún no hay recursos sincronizados.</strong><span>Al encender un nodo, su heartbeat aparecerá aquí automáticamente.</span></div> : (
          <div className="table-wrap"><table><thead><tr><th>Recurso</th><th>Tipo</th><th>Zona</th><th>Estado</th><th>Señal</th><th>Último contacto</th></tr></thead><tbody>{resources.map(({ id, event, resource, mapPoint }) => (
            <tr key={id}><td><span className="cell-main mono">{resource.node}</span><div className="cell-sub">{mapPoint ? `${mapPoint.lat}, ${mapPoint.lon} aprox.` : "Sin posición"}</div></td><td>{resource.kind || "RECURSO"}</td><td>{resource.zone || "SIN ZONA"}</td><td><span className={`badge ${resource.state === "disponible" ? "success" : ""}`}>{resource.state ?? "sin estado"}</span></td><td className="mono">{resource.rssi || "—"} / {resource.snr || "—"}</td><td>{formatEventTime(resource.last_seen ?? event.occurred_at)}</td></tr>
          ))}</tbody></table></div>
        )}
      </section>
    </section>
  );
}
