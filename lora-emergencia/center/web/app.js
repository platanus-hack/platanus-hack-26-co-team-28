"use strict";

const titles = {
  overview: "Overview",
  requests: "Solicitudes",
  resources: "Recursos",
  network: "Red LoRa",
  broadcasts: "Broadcasts",
  "safe-people": "Personas a salvo",
  simulator: "Simulador",
};
const state = {
  demo: false,
  overview: null,
  loading: false,
  lastUpdate: 0,
  apiToken: sessionStorage.getItem("apiToken") || "",
  requestFilters: { q: "", state: "", category: "", priority: "" },
  broadcastDraft: null,
  broadcastReviewed: false,
  broadcastConfirmed: false,
};
const content = document.querySelector("#content");
const drawer = document.querySelector("#drawer");
const scrim = document.querySelector("#scrim");
const appShell = document.querySelector("#app-shell");
const sidebarToggle = document.querySelector("#sidebar-toggle");
const syncButton = document.querySelector("#sync-button");
const lastSync = document.querySelector("#last-sync");

function setSidebarCollapsed(collapsed, persist = true) {
  appShell.classList.toggle("sidebar-collapsed", collapsed);
  sidebarToggle.textContent = collapsed ? "›" : "‹";
  sidebarToggle.setAttribute("aria-expanded", String(!collapsed));
  sidebarToggle.setAttribute("aria-label", collapsed ? "Expandir navegación" : "Colapsar navegación");
  if (persist) localStorage.setItem("sidebarExpanded", String(!collapsed));
}

setSidebarCollapsed(localStorage.getItem("sidebarExpanded") !== "true", false);
sidebarToggle.addEventListener("click", () => setSidebarCollapsed(!appShell.classList.contains("sidebar-collapsed")));

function updateSyncStatus() {
  lastSync.textContent = state.lastUpdate ? `Actualizado ${new Date(state.lastUpdate).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}` : "Sin sincronizar";
}

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]));
const formatDate = (value) => value ? new Date(value * 1000).toLocaleString("es-CO") : "Sin dato";
const ago = (value) => {
  if (!value) return "sin señal";
  const seconds = Math.max(0, Math.round(Date.now() / 1000 - value));
  if (seconds < 60) return `hace ${seconds} s`;
  if (seconds < 3600) return `hace ${Math.floor(seconds / 60)} min`;
  return `hace ${Math.floor(seconds / 3600)} h`;
};
const priorityBadge = (value) => `<span class="badge ${value === 0 ? "critical" : value === 1 ? "warning" : ""}">Prioridad ${value}</span>`;
const stateBadge = (value) => `<span class="badge ${value === "disponible" || value === "RESUELTA" ? "success" : value === "CANCELADA" ? "critical" : ""}">${escapeHtml(value)}</span>`;
const empty = (message) => `<div class="empty">${escapeHtml(message)}</div>`;

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (state.apiToken) headers.set("Authorization", `Bearer ${state.apiToken}`);
  const response = await fetch(path, { ...options, headers });
  let data;
  try { data = await response.json(); } catch (_error) { data = {}; }
  if (!response.ok) throw new Error(data.error || `Error HTTP ${response.status}`);
  return data;
}

function notify(message, error = false) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.style.background = error ? "#991b1b" : "#111";
  toast.hidden = false;
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => { toast.hidden = true; }, 4000);
}

function route() {
  const value = location.hash.slice(1).split("?")[0];
  return titles[value] ? value : "overview";
}

function setNavigation(current) {
  document.querySelectorAll("#nav a").forEach((link) => {
    if (link.dataset.route === current) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  document.querySelector("#page-title").textContent = titles[current];
}

async function renderRoute() {
  const current = route();
  if (current === "simulator" && !state.demo) {
    location.hash = "overview";
    return;
  }
  setNavigation(current);
  content.innerHTML = '<div class="empty">Cargando datos operacionales…</div>';
  try {
    const renderers = { overview: renderOverview, requests: renderRequests, resources: renderResources, network: renderNetwork, broadcasts: renderBroadcasts, "safe-people": renderSafePeople, simulator: renderSimulator };
    await renderers[current]();
    content.focus({ preventScroll: true });
    return true;
  } catch (error) {
    content.innerHTML = `<div class="panel"><div class="empty">No se pudo cargar: ${escapeHtml(error.message)}</div></div>`;
    return false;
  }
}

async function getOverview() {
  state.overview = await api("/api/v1/overview");
  state.demo = state.overview.demo;
  state.lastUpdate = Date.now();
  updateSyncStatus();
  document.querySelector("#simulator-nav").hidden = !state.demo;
  const connected = state.overview.gateway;
  document.querySelector("#connection-dot").classList.toggle("connected", connected);
  document.querySelector("#connection-text").textContent = connected ? "Gateway conectado" : "Gateway desconectado";
  document.querySelector("#live-badge").textContent = connected ? "En vivo" : "Centro local";
  return state.overview;
}

async function renderOverview() {
  const data = await getOverview();
  const metrics = data.metrics;
  content.innerHTML = `
    <div class="page-head"><div><h2>Situación operacional</h2><p>Decisiones pendientes y estado observado de la red.</p></div><span class="badge ${data.gateway ? "success" : "warning"}">${data.gateway ? "Gateway conectado" : "Sin radio"}</span></div>
    <section class="metrics" aria-label="Métricas accionables">
      ${metric(metrics.critical, "Solicitudes críticas")}${metric(metrics.pending, "Decisiones pendientes")}${metric(metrics.available_resources, "Recursos disponibles")}${metric(metrics.open_requests, "Solicitudes abiertas")}
    </section>
    <div class="grid">
      <section class="panel"><div class="panel-head"><div><h3>Esquema de ubicaciones</h3><span class="muted">${centerPositionLabel(data.center_position)}${data.resources_truncated ? ` · mostrando 200 de ${data.resources_total} recursos` : ""}</span></div><div class="panel-actions"><button id="locate-center" class="button" type="button">Usar ubicación actual</button><button id="manual-center" class="button" type="button">Ingresar coordenadas</button></div></div><div id="map" class="map"><span class="map-note">Esquema offline · sin cartografía formal</span></div></section>
      <section class="panel"><div class="panel-head"><h3>Cola priorizada</h3><a class="button" href="#requests">Ver todas</a></div><div class="list">${data.requests.length ? data.requests.slice(0, 7).map(requestListItem).join("") : empty("Sin solicitudes abiertas")}</div></section>
    </div>
    <section class="panel" style="margin-top:16px"><div class="panel-head"><h3>Actividad reciente de radio</h3><a class="button" href="#network">Abrir red</a></div>${radioTable(data.recent_activity)}</section>`;
  plotMap(data.requests, data.resources, data.center_position);
  document.querySelector("#locate-center").addEventListener("click", locateCenter);
  document.querySelector("#manual-center").addEventListener("click", enterCenterPosition);
  bindRequestRows();
}

function centerPositionLabel(position) {
  if (!position) return "Centro sin ubicación · posiciones observadas";
  const accuracy = position.accuracy == null ? "" : ` · ±${Math.round(position.accuracy)} m`;
  return `Centro: ${escapeHtml(position.source.toLowerCase())}${accuracy} · ${ago(position.captured_at)}`;
}

async function saveCenterPosition(lat, lon, accuracy, source) {
  await api("/api/v1/center-position", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat, lon, accuracy, source }),
  });
  notify("Ubicación del centro guardada para uso offline");
  await renderOverview();
}

function locateCenter() {
  if (!navigator.geolocation) {
    notify("Este navegador no ofrece ubicación; ingrésala manualmente", true);
    return;
  }
  const button = document.querySelector("#locate-center");
  button.disabled = true;
  button.textContent = "Obteniendo ubicación…";
  navigator.geolocation.getCurrentPosition(async (position) => {
    const { latitude, longitude, accuracy } = position.coords;
    const summary = `${latitude.toFixed(6)}, ${longitude.toFixed(6)} (±${Math.round(accuracy)} m)`;
    if (!confirm(`Ubicación obtenida:\n${summary}\n\n¿Guardar como posición del centro?`)) {
      button.disabled = false; button.textContent = "Usar ubicación actual"; return;
    }
    try { await saveCenterPosition(latitude, longitude, accuracy, "NAVEGADOR"); }
    catch (error) { notify(error.message, true); button.disabled = false; button.textContent = "Usar ubicación actual"; }
  }, (error) => {
    const reasons = { 1: "Permiso de ubicación denegado", 2: "Ubicación no disponible", 3: "La ubicación tardó demasiado" };
    notify(`${reasons[error.code] || "No se pudo obtener la ubicación"}. Puedes ingresarla manualmente.`, true);
    button.disabled = false; button.textContent = "Usar ubicación actual";
  }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
}

async function enterCenterPosition() {
  const lat = prompt("Latitud del centro", state.overview?.center_position?.lat ?? "");
  if (lat === null) return;
  const lon = prompt("Longitud del centro", state.overview?.center_position?.lon ?? "");
  if (lon === null) return;
  if (!confirm(`Guardar ${lat}, ${lon} como ubicación manual del centro?`)) return;
  try { await saveCenterPosition(lat, lon, null, "MANUAL"); }
  catch (error) { notify(error.message, true); }
}

function metric(value, label) { return `<div class="metric"><strong>${value}</strong><span>${escapeHtml(label)}</span></div>`; }
function requestListItem(item) {
  const triage = item.triage || { priority: item.priority };
  return `<button class="list-item request-row" data-request-id="${item.id}" style="width:100%;text-align:left;background:#fff;border:0;border-bottom:1px solid var(--border);cursor:pointer">
    <div class="list-line"><strong>#${item.id} · ${escapeHtml(item.category)}</strong>${priorityBadge(triage.priority)}${stateBadge(item.state)}</div>
    <div>${escapeHtml(item.detail || item.place || "Sin detalle")}</div><div class="cell-sub mono">${escapeHtml(item.node)} · ${ago(item.created_at)}</div>
  </button>`;
}

function plotMap(requests, resources, centerPosition) {
  const items = [
    ...(centerPosition && validCoordinate(centerPosition.lat, centerPosition.lon) ? [{ ...centerPosition, mapType: "center", label: `${centerPosition.label} · ubicación ${centerPosition.source.toLowerCase()}` }] : []),
    ...requests.filter((item) => validCoordinate(item.lat, item.lon)).map((item) => ({ ...item, mapType: "request", label: `Solicitud #${item.id}` })),
    ...resources.filter((item) => validCoordinate(item.lat, item.lon)).map((item) => ({ ...item, mapType: "resource", label: item.node })),
  ];
  if (!items.length) return;
  const latitudes = items.map((item) => Number(item.lat));
  const longitudes = items.map((item) => Number(item.lon));
  const minLat = Math.min(...latitudes) - .001;
  const maxLat = Math.max(...latitudes) + .001;
  const minLon = Math.min(...longitudes) - .001;
  const maxLon = Math.max(...longitudes) + .001;
  const map = document.querySelector("#map");
  items.forEach((item) => {
    const dot = document.createElement("span");
    dot.className = `map-dot ${item.mapType}`;
    dot.style.left = `${5 + 88 * ((Number(item.lon) - minLon) / (maxLon - minLon))}%`;
    dot.style.top = `${5 + 84 * (1 - (Number(item.lat) - minLat) / (maxLat - minLat))}%`;
    dot.title = item.label;
    dot.setAttribute("aria-label", item.label);
    map.appendChild(dot);
  });
}
function validCoordinate(lat, lon) { return lat !== "" && lon !== "" && Number.isFinite(Number(lat)) && Number.isFinite(Number(lon)); }

async function renderRequests() {
  const params = new URLSearchParams(state.requestFilters);
  const data = await api(`/api/v1/requests?${params}&limit=150`);
  content.innerHTML = `
    <div class="page-head"><div><h2>Solicitudes</h2><p>Triage explicable, candidatos y autorización humana.</p></div><span class="badge">${data.count} resultados</span></div>
    <form id="request-filters" class="filters">
       <div class="field"><label for="request-q">Buscar</label><input id="request-q" name="q" value="${escapeHtml(state.requestFilters.q)}" placeholder="Nodo, lugar o detalle"></div>
       <div class="field"><label for="request-state">Estado</label><select id="request-state" name="state"><option value="">Todos</option>${["PENDIENTE","EN_REVISION","ENVIO_INDETERMINADO","DESPACHADA","ACEPTADA","EN_CURSO","RESUELTA","CANCELADA"].map((value) => option(value, state.requestFilters.state)).join("")}</select></div>
       <div class="field"><label for="request-category">Categoría</label><select id="request-category" name="category"><option value="">Todas</option>${["MEDICO","RESCATE","GRUA","AGUA","FUEGO"].map((value) => option(value, state.requestFilters.category)).join("")}</select></div>
       <div class="field"><label for="request-priority">Prioridad</label><select id="request-priority" name="priority"><option value="">Todas</option>${[0,1,2,3].map((value) => option(value, state.requestFilters.priority)).join("")}</select></div>
      <button class="button" type="submit">Aplicar filtros</button>
    </form>
    <section class="panel" id="request-results">${requestsTable(data.items)}</section>`;
  const filterForm = document.querySelector("#request-filters");
  filterForm.addEventListener("submit", filterRequests);
  filterForm.addEventListener("input", () => { state.requestFilters = Object.fromEntries(new FormData(filterForm)); });
  filterForm.addEventListener("change", () => { state.requestFilters = Object.fromEntries(new FormData(filterForm)); });
  bindRequestRows();
}
function option(value, selected = "") { return `<option value="${value}"${String(value) === String(selected) ? " selected" : ""}>${value}</option>`; }
async function filterRequests(event) {
  event.preventDefault();
  state.requestFilters = Object.fromEntries(new FormData(event.currentTarget));
  const params = new URLSearchParams(state.requestFilters);
  params.set("limit", "150");
  try {
    const data = await api(`/api/v1/requests?${params}`);
    document.querySelector("#request-results").innerHTML = requestsTable(data.items);
    bindRequestRows();
  } catch (error) { notify(error.message, true); }
}
function requestsTable(items) {
  if (!items.length) return empty("No hay solicitudes con estos filtros");
  return `<div class="table-wrap"><table><thead><tr><th>Solicitud</th><th>Prioridad efectiva</th><th>Estado</th><th>Asignación</th><th>Ingreso</th></tr></thead><tbody>${items.map((item) => `<tr class="clickable request-row" tabindex="0" data-request-id="${item.id}"><td><div class="cell-main">#${item.id} · ${escapeHtml(item.category)}</div><div class="cell-sub">${escapeHtml(item.detail || item.place || "Sin detalle")}</div></td><td>${priorityBadge(item.triage.priority)}${item.triage.priority < item.priority ? '<div class="cell-sub">Escalada desde nodo</div>' : ""}</td><td>${stateBadge(item.state)}</td><td class="mono">${escapeHtml(item.resource_node || "Sin asignar")}</td><td>${ago(item.created_at)}</td></tr>`).join("")}</tbody></table></div>`;
}
function bindRequestRows() {
  document.querySelectorAll(".request-row").forEach((row) => {
    row.addEventListener("click", () => openRequest(Number(row.dataset.requestId)));
    row.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") openRequest(Number(row.dataset.requestId)); });
  });
}

async function openRequest(id) {
  try {
    const [request, timeline] = await Promise.all([api(`/api/v1/requests/${id}`), api(`/api/v1/requests/${id}/timeline`)]);
    const triage = request.triage;
    const canDispatch = ["PENDIENTE", "EN_REVISION"].includes(request.state) && !request.resource_node && triage.candidates.length;
    document.querySelector("#drawer-content").innerHTML = `
      <section class="detail-section"><h3>Solicitud #${request.id}</h3><dl class="key-values"><dt>Categoría</dt><dd>${escapeHtml(request.category)}</dd><dt>Estado</dt><dd>${stateBadge(request.state)}</dd><dt>Origen</dt><dd class="mono">${escapeHtml(request.node)} / ${request.seq}</dd><dt>Lugar</dt><dd>${escapeHtml(request.place || "Sin lugar")}</dd><dt>Detalle</dt><dd>${escapeHtml(request.detail || "Sin detalle")}</dd><dt>Radio</dt><dd class="mono">RSSI ${escapeHtml(request.rssi || "—")} · SNR ${escapeHtml(request.snr || "—")}</dd></dl></section>
      <section class="detail-section"><h3>Triage explicable</h3><div class="review"><div class="list-line">${priorityBadge(triage.priority)} <span class="muted">Reportada: ${request.priority}</span></div><p>${triage.reasons.map(escapeHtml).join(" · ")}</p>${triage.alerts.length ? `<p class="badge warning">${triage.alerts.map(escapeHtml).join(" · ")}</p>` : ""}</div></section>
      <section class="detail-section"><h3>Candidatos</h3>${triage.candidates.length ? `<div class="list">${triage.candidates.map((item) => `<div class="list-item"><strong class="mono">${escapeHtml(item.node)}</strong><div class="cell-sub">${item.distance_km == null ? "Posición no reciente" : `${item.distance_km} km`} · contacto hace ${item.last_seen_seconds} s</div></div>`).join("")}</div>` : empty("Sin candidatos elegibles")}</section>
      ${canDispatch ? dispatchForm(request, triage.recommended_resource.node) : ""}
      ${humanActions(request)}
      <section class="detail-section"><h3>Timeline auditable</h3>${timeline.items.length ? `<div class="timeline">${timeline.items.map((item) => `<div class="timeline-item"><strong>${escapeHtml(item.event_type)}</strong><div>${escapeHtml(item.from_state || "Inicio")} → ${escapeHtml(item.to_state || "Sin cambio")}</div><div class="cell-sub">${escapeHtml(item.actor || "sistema")} · ${escapeHtml(item.reason || "Sin motivo")} · ${formatDate(item.created_at)}</div></div>`).join("")}</div>` : empty("Sin eventos")}</section>`;
    document.querySelector("#dispatch-form")?.addEventListener("submit", submitDispatch);
    document.querySelector("#action-form")?.addEventListener("submit", submitAction);
    drawer.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
    scrim.hidden = false;
    document.querySelector("#close-drawer").focus();
  } catch (error) { notify(error.message, true); }
}
function dispatchForm(request, suggested) {
  return `<section class="detail-section"><h3>Autorizar despacho</h3><form id="dispatch-form" data-request-id="${request.id}" class="review"><div class="field"><label for="resource-node">Nodo recurso</label><input id="resource-node" name="resource_node" value="${escapeHtml(suggested)}" required maxlength="24"></div><div class="field"><label for="dispatch-actor">Operador</label><input id="dispatch-actor" name="actor" required maxlength="64"></div><div class="field"><label for="dispatch-reason">Motivo</label><textarea id="dispatch-reason" name="reason" maxlength="240" placeholder="Justificación operacional"></textarea></div><label class="list-line" style="margin-top:10px"><input name="confirmed" type="checkbox" required style="width:20px;min-height:20px"> Confirmo que revisé solicitud, prioridad y recurso.</label><div class="form-actions"><button class="button action" type="submit">Transmitir despacho</button></div></form></section>`;
}
function humanActions(request) {
  const actions = [];
  if (request.state === "PENDIENTE") actions.push(["review", "Marcar en revisión"]);
  if (request.state === "ENVIO_INDETERMINADO") actions.push(["release", "Liberar recurso y reabrir"]);
  if (["PENDIENTE", "EN_REVISION"].includes(request.state) && !request.resource_node) actions.push(["cancel", "Cancelar"]);
  if (["ACEPTADA", "EN_CURSO"].includes(request.state)) actions.push(["resolve", "Resolver"]);
  if (!actions.length) return "";
  return `<section class="detail-section"><h3>Acción humana</h3><form id="action-form" data-request-id="${request.id}" class="review"><div class="field"><label for="action">Acción</label><select id="action" name="action">${actions.map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select></div><div class="field"><label for="action-actor">Operador</label><input id="action-actor" name="actor" required maxlength="64"></div><div class="field"><label for="action-reason">Motivo obligatorio</label><textarea id="action-reason" name="reason" required minlength="3" maxlength="240"></textarea></div><div class="form-actions"><button class="button" type="submit">Registrar acción</button></div></form></section>`;
}
async function submitDispatch(event) {
  event.preventDefault();
  const button = event.currentTarget.querySelector("button[type=submit]");
  button.disabled = true;
  const values = Object.fromEntries(new FormData(event.currentTarget));
  delete values.confirmed;
  try {
    const result = await api(`/api/v1/requests/${event.currentTarget.dataset.requestId}/dispatch`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
    notify(`Despacho transmitido con prioridad ${result.effective_priority}`);
    closeDrawer(); await refreshCurrent();
  } catch (error) { notify(error.message, true); button.disabled = false; }
}
async function submitAction(event) {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.currentTarget));
  try {
    await api(`/api/v1/requests/${event.currentTarget.dataset.requestId}/actions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
    notify("Acción registrada en el timeline"); closeDrawer(); await refreshCurrent();
  } catch (error) { notify(error.message, true); }
}

async function renderResources() {
  const data = await api("/api/v1/resources");
  content.innerHTML = `<div class="page-head"><div><h2>Recursos</h2><p>Contacto y frescura de posición se muestran por separado.</p></div><span class="badge">${data.items.length} nodos</span></div>
    <form id="resource-filters" class="filters"><div class="field"><label for="resource-state">Estado</label><select id="resource-state" name="state"><option value="">Todos</option>${["disponible","reservado","asignado","enruta","enlugar","resuelta","cancelada"].map(option).join("")}</select></div><div class="field"><label for="resource-kind">Tipo</label><select id="resource-kind" name="kind"><option value="">Todos</option>${["MEDICO","RESCATE","GRUA","AGUA","FUEGO"].map(option).join("")}</select></div><div class="field"><label for="resource-zone">Zona operativa</label><input id="resource-zone" name="zone" maxlength="24"></div><button class="button" type="submit">Aplicar filtros</button></form>
    <section id="resource-results" class="panel">${resourcesTable(data.items)}</section>`;
  document.querySelector("#resource-filters").addEventListener("submit", async (event) => { event.preventDefault(); try { const result = await api(`/api/v1/resources?${new URLSearchParams(new FormData(event.currentTarget))}`); document.querySelector("#resource-results").innerHTML = resourcesTable(result.items); } catch (error) { notify(error.message, true); } });
}
function resourcesTable(items) {
  if (!items.length) return empty("No hay recursos con estos filtros");
  return `<div class="table-wrap"><table><thead><tr><th>Nodo / tipo</th><th>Estado</th><th>Zona</th><th>Heartbeat</th><th>Posición</th><th>Radio</th></tr></thead><tbody>${items.map((item) => `<tr><td><div class="cell-main mono">${escapeHtml(item.node)}</div><div class="cell-sub">${escapeHtml(item.kind)}</div></td><td>${stateBadge(item.state)}</td><td>${escapeHtml(item.zone)}</td><td>${ago(item.last_seen)}</td><td>${item.position_seen_at ? `${ago(item.position_seen_at)}<div class="cell-sub mono">${escapeHtml(item.lat)}, ${escapeHtml(item.lon)} · ±${escapeHtml(item.accuracy || "—")} m</div>` : "Sin posición"}</td><td class="mono">RSSI ${escapeHtml(item.rssi || "—")}<br>SNR ${escapeHtml(item.snr || "—")}</td></tr>`).join("")}</tbody></table></div>`;
}

async function renderNetwork() {
  const [network, events] = await Promise.all([api("/api/v1/network"), api("/api/v1/radio-events?limit=150")]);
  content.innerHTML = `<div class="page-head"><div><h2>Red LoRa</h2><p>Salud del gateway, nodos observados y trazas RX/TX.</p></div><span class="badge ${network.gateway.connected ? "success" : "warning"}">${network.gateway.connected ? "Gateway conectado" : "Gateway desconectado"}</span></div>
    <section class="metrics">${metric(network.totals.nodes, "Nodos registrados")}${metric(network.totals.rx, "Frames RX recientes")}${metric(network.totals.tx, "Frames TX recientes")}${metric(network.nodes.filter((item) => Date.now()/1000-item.last_seen <= 600).length, "Nodos con contacto reciente")}</section>
    <div class="grid equal"><section class="panel"><div class="panel-head"><h3>Nodos</h3>${network.nodes_truncated ? `<span class="muted">Mostrando 200 de ${network.totals.nodes}</span>` : ""}</div>${resourcesTable(network.nodes)}</section><section class="panel"><div class="panel-head"><h3>Log de radio</h3></div>${radioTable(events.items)}</section></div>`;
}
function radioTable(items) {
  if (!items.length) return empty("Sin eventos de radio");
  return `<div class="table-wrap"><table><thead><tr><th>Dir.</th><th>Frame</th><th>Resultado</th><th>Hora</th></tr></thead><tbody>${items.map((item) => `<tr><td>${stateBadge(item.direction)}</td><td class="activity-code">${escapeHtml(item.origin)} → ${escapeHtml(item.destination)}<br>${escapeHtml(item.kind)} / ${item.message_id}</td><td>${escapeHtml(item.result || "RECIBIDO")}</td><td>${ago(item.created_at)}</td></tr>`).join("")}</tbody></table></div>`;
}

async function renderBroadcasts() {
  const data = await api("/api/v1/broadcasts?limit=100");
  content.innerHTML = `<div class="page-head"><div><h2>Broadcasts</h2><p>Composición, revisión explícita y recibos técnicos por nodo.</p></div></div><div class="grid equal"><section class="panel"><div class="panel-head"><h3>Nuevo broadcast</h3></div><div class="panel-body" id="broadcast-composer">${broadcastComposer()}</div></section><section class="panel"><div class="panel-head"><h3>Seguimiento</h3></div>${broadcastList(data.items)}</section></div>`;
  bindBroadcastForm();
  document.querySelectorAll(".broadcast-detail").forEach((button) => button.addEventListener("click", () => openBroadcast(button.dataset.id)));
}
function broadcastForm() { const draft = state.broadcastDraft || { message: "", scope: "ALL", priority: "NORMAL", expires_in: "300" }; return `<form id="broadcast-form"><div class="field"><label for="broadcast-message">Mensaje (máximo 80)</label><textarea id="broadcast-message" name="message" required maxlength="80">${escapeHtml(draft.message)}</textarea></div><div class="field"><label for="broadcast-scope">Audiencia</label><select id="broadcast-scope" name="scope"><option value="ALL"${draft.scope === "ALL" ? " selected" : ""}>Todos los nodos</option><option value="ZONE:NORTE"${draft.scope === "ZONE:NORTE" ? " selected" : ""}>Zona NORTE</option><option value="ZONE:CENTRO"${draft.scope === "ZONE:CENTRO" ? " selected" : ""}>Zona CENTRO</option></select></div><div class="field"><label for="broadcast-priority">Prioridad</label><select id="broadcast-priority" name="priority"><option value="NORMAL"${draft.priority === "NORMAL" ? " selected" : ""}>Normal</option><option value="URGENT"${draft.priority === "URGENT" ? " selected" : ""}>Urgente</option></select></div><div class="field"><label for="broadcast-expiration">Expira en</label><select id="broadcast-expiration" name="expires_in"><option value="300"${draft.expires_in === "300" ? " selected" : ""}>5 minutos</option><option value="1800"${draft.expires_in === "1800" ? " selected" : ""}>30 minutos</option><option value="3600"${draft.expires_in === "3600" ? " selected" : ""}>1 hora</option></select></div><div class="form-actions"><button class="button primary" type="submit">Revisar antes de transmitir</button></div></form>`; }
function broadcastComposer() { if (!state.broadcastReviewed || !state.broadcastDraft) return broadcastForm(); return `<div class="review"><span class="badge ${state.broadcastDraft.priority === "URGENT" ? "critical" : ""}">${escapeHtml(state.broadcastDraft.priority)}</span><h3>${escapeHtml(state.broadcastDraft.scope)}</h3><p>${escapeHtml(state.broadcastDraft.message)}</p><p class="muted">El envío por radio no equivale a confirmación humana. Los recibos BCA son técnicos.</p><label class="list-line"><input id="broadcast-confirmed" type="checkbox"${state.broadcastConfirmed ? " checked" : ""} style="width:20px;min-height:20px"> Revisé audiencia, prioridad y expiración.</label><div class="form-actions"><button id="edit-broadcast" class="button">Editar</button><button id="send-broadcast" class="button action">Transmitir</button></div></div>`; }
function bindBroadcastForm() { const form = document.querySelector("#broadcast-form"); const saveDraft = () => { state.broadcastDraft = Object.fromEntries(new FormData(form)); }; form?.addEventListener("submit", reviewBroadcast); form?.addEventListener("input", saveDraft); form?.addEventListener("change", saveDraft); document.querySelector("#broadcast-confirmed")?.addEventListener("change", (event) => { state.broadcastConfirmed = event.currentTarget.checked; }); document.querySelector("#send-broadcast")?.addEventListener("click", sendBroadcast); document.querySelector("#edit-broadcast")?.addEventListener("click", () => { state.broadcastReviewed = false; state.broadcastConfirmed = false; document.querySelector("#broadcast-composer").innerHTML = broadcastForm(); bindBroadcastForm(); }); }
function reviewBroadcast(event) {
  event.preventDefault(); state.broadcastDraft = Object.fromEntries(new FormData(event.currentTarget)); state.broadcastReviewed = true; state.broadcastConfirmed = false;
  document.querySelector("#broadcast-composer").innerHTML = broadcastComposer(); bindBroadcastForm();
}
async function sendBroadcast() {
  if (!document.querySelector("#broadcast-confirmed").checked) return notify("Confirma la revisión operacional", true);
  try { await api("/api/v1/broadcasts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(state.broadcastDraft) }); notify("Broadcast transmitido; esperando recibos técnicos"); state.broadcastDraft = null; state.broadcastReviewed = false; state.broadcastConfirmed = false; await renderBroadcasts(); } catch (error) { notify(error.message, true); }
}
function broadcastList(items) { return items.length ? `<div class="list">${items.map((item) => `<button class="list-item broadcast-detail" data-id="${item.message_id}" style="text-align:left;background:#fff;border:0;border-bottom:1px solid var(--border);cursor:pointer"><div class="list-line"><strong class="mono">#${item.message_id}</strong><span class="badge">${escapeHtml(item.scope)}</span><span class="badge ${item.priority === "URGENT" ? "critical" : ""}">${escapeHtml(item.priority)}</span><span class="badge">${escapeHtml(item.status)}</span></div><div>${escapeHtml(item.message)}</div><div class="cell-sub">${item.received_count} recibos técnicos · ${ago(item.created_at)}</div></button>`).join("")}</div>` : empty("Sin broadcasts enviados"); }
async function openBroadcast(id) { try { const item = await api(`/api/v1/broadcasts/${id}`); document.querySelector("#drawer-content").innerHTML = `<section class="detail-section"><h3>Broadcast #${item.message_id}</h3><p>${escapeHtml(item.message)}</p><dl class="key-values"><dt>Audiencia</dt><dd>${escapeHtml(item.scope)}</dd><dt>Prioridad</dt><dd>${escapeHtml(item.priority)}</dd><dt>Expiración</dt><dd>${formatDate(item.expires_at)}</dd></dl></section><section class="detail-section"><h3>Recibos técnicos BCA</h3>${item.receipts.length ? `<div class="list">${item.receipts.map((receipt) => `<div class="list-item"><strong class="mono">${escapeHtml(receipt.node)}</strong><div class="cell-sub">${formatDate(receipt.received_at)}</div></div>`).join("")}</div>` : empty("Ningún nodo ha confirmado recepción técnica")}</section>`; drawer.classList.add("open"); drawer.setAttribute("aria-hidden", "false"); scrim.hidden = false; } catch (error) { notify(error.message, true); } }

async function renderSafePeople() {
  const data = await api("/api/v1/safe-people?limit=150");
  content.innerHTML = `<div class="page-head"><div><h2>Personas a salvo</h2><p>Registros OK recibidos desde nodos civiles.</p></div><span class="badge success">${data.items.length} registros</span></div><form id="safe-search" class="filters"><div class="field"><label for="safe-q">Buscar por nombre, documento, lugar o nodo</label><input id="safe-q" name="q"></div><button class="button" type="submit">Buscar</button></form><section id="safe-results" class="panel">${safeTable(data.items)}</section>`;
  document.querySelector("#safe-search").addEventListener("submit", async (event) => { event.preventDefault(); try { const result = await api(`/api/v1/safe-people?${new URLSearchParams(new FormData(event.currentTarget))}&limit=150`); document.querySelector("#safe-results").innerHTML = safeTable(result.items); } catch (error) { notify(error.message, true); } });
}
function safeTable(items) { return items.length ? `<div class="table-wrap"><table><thead><tr><th>Persona</th><th>Documento</th><th>Lugar</th><th>Nodo</th><th>Registro</th></tr></thead><tbody>${items.map((item) => `<tr><td><strong>${escapeHtml(item.name)}</strong></td><td class="mono">${escapeHtml(item.document)}</td><td>${escapeHtml(item.place || "Sin lugar")}<div class="cell-sub mono">${escapeHtml(item.lat)}, ${escapeHtml(item.lon)}</div></td><td class="mono">${escapeHtml(item.node)}</td><td>${formatDate(item.created_at)}</td></tr>`).join("")}</tbody></table></div>` : empty("No se encontraron personas"); }

async function renderSimulator() {
  content.innerHTML = `<div class="page-head"><div><h2>Simulador</h2><p>Solo demo. Inyecta frames reales mediante CenterStore.ingest.</p></div><span class="badge warning">Modo demo</span></div><div class="grid equal"><section class="panel"><div class="panel-head"><h3>Escenarios</h3></div><div class="panel-body"><div class="field"><label for="scenario">Escenario operacional</label><select id="scenario"><option value="critical-medical">Solicitud médica crítica</option><option value="rescue">Rescate con atrapados</option><option value="medical-resource">Recurso médico disponible</option></select></div><div class="form-actions"><button id="run-scenario" class="button action">Inyectar escenario</button></div></div></section><section class="panel"><div class="panel-head"><h3>Frame de protocolo</h3></div><div class="panel-body"><form id="frame-form"><div class="field"><label for="raw-frame">Frame dirigido a CENTRO</label><textarea id="raw-frame" name="frame" required maxlength="512">SIM-CIVIL|CENTRO|SOS|99|MEDICO|2|4.6712|-74.0530|Centro|persona inconsciente</textarea></div><div class="form-actions"><button class="button primary">Inyectar frame</button></div></form></div></section></div>`;
  document.querySelector("#run-scenario").addEventListener("click", async () => injectSimulator("scenarios", { scenario: document.querySelector("#scenario").value }));
  document.querySelector("#frame-form").addEventListener("submit", (event) => { event.preventDefault(); injectSimulator("frames", Object.fromEntries(new FormData(event.currentTarget))); });
}
async function injectSimulator(endpoint, body) { try { const result = await api(`/api/v1/simulator/${endpoint}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); notify(`${result.results.length} frame(s) procesados`); } catch (error) { notify(error.message, true); } }

function closeDrawer() { drawer.classList.remove("open"); drawer.setAttribute("aria-hidden", "true"); scrim.hidden = true; }
document.querySelector("#close-drawer").addEventListener("click", closeDrawer);
scrim.addEventListener("click", closeDrawer);
document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeDrawer(); });
window.addEventListener("hashchange", renderRoute);

async function refreshCurrent() {
  const editing = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);
  if (state.loading || document.hidden || editing || drawer.classList.contains("open") || route() === "simulator") return;
  state.loading = true;
  try {
    const ok = await renderRoute();
    if (ok) { state.lastUpdate = Date.now(); updateSyncStatus(); }
    return ok;
  } finally { state.loading = false; }
}

async function syncNow() {
  if (state.loading) return;
  state.loading = true;
  syncButton.disabled = true;
  syncButton.textContent = "Sincronizando…";
  try {
    const ok = await renderRoute();
    if (!ok) throw new Error("No se pudo actualizar");
    state.lastUpdate = Date.now(); updateSyncStatus();
    notify("Datos locales sincronizados");
  } catch (error) { notify(error.message, true); }
  finally { state.loading = false; syncButton.disabled = false; syncButton.textContent = "↻ Sincronizar"; }
}

let pollTimer = null;
let pollDelay = 3000;
let sseHealthy = false;
function stopPolling() { clearTimeout(pollTimer); pollTimer = null; pollDelay = 3000; }
function startPolling(delay = pollDelay) {
  if (pollTimer || sseHealthy) return;
  document.querySelector("#live-badge").textContent = "Polling";
  pollTimer = setTimeout(async function poll() {
    pollTimer = null;
    const ok = await refreshCurrent();
    pollDelay = ok ? 3000 : Math.min(pollDelay * 2, 30000);
    if (!sseHealthy) startPolling(pollDelay);
  }, delay);
}

function connectEvents() {
  if (!("EventSource" in window) || state.apiToken) { startPolling(); return; }
  const source = new EventSource("/api/v1/events");
  source.addEventListener("update", refreshCurrent);
  source.addEventListener("open", () => { sseHealthy = true; stopPolling(); document.querySelector("#live-badge").textContent = "En vivo"; });
  source.addEventListener("ready", () => { sseHealthy = true; stopPolling(); document.querySelector("#live-badge").textContent = "En vivo"; });
  source.onerror = () => { sseHealthy = false; startPolling(pollDelay); };
}

setInterval(() => { document.querySelector("#clock").textContent = new Date().toLocaleTimeString("es-CO"); }, 1000);
syncButton.addEventListener("click", syncNow);
document.querySelector("#api-token-button").addEventListener("click", () => {
  const token = window.prompt("Token API (se guarda solo en esta pestaña):", state.apiToken);
  if (token === null) return;
  if (token.trim()) sessionStorage.setItem("apiToken", token.trim()); else sessionStorage.removeItem("apiToken");
  location.reload();
});
getOverview().then(() => renderRoute()).catch(() => renderRoute());
connectEvents();
