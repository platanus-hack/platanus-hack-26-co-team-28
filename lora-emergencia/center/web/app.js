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
  renderedRoute: null,
  mapFilters: { request: true, resource: true },
  onlineMapConsent: sessionStorage.getItem("onlineMapConsent") === "true",
  offlineMap: null,
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
// Responsable de grúa interno por defecto. Cada solicitud que llega queda con un
// asignado automatico (tag) y el campo Operador de los formularios viene
// pre-lleno con este nombre. El operador lo puede cambiar antes de confirmar.
// 2 perfiles distintos en 2 apps distintas:
// - OPERADOR_CENTRO: quien opera ESTE dashboard (puesto de mando). Aparece en
//   los formularios de despacho/accion humana de esta pantalla.
// - RESPONSABLE_GRUA: el conductor/operador de la grua GRUA07 (app separada
//   grua.html). Aparece como tag "Asignado" en la solicitud, NO en los
//   formularios del centro (esos los llena el operador del centro, no el de
//   la grua).
const OPERADOR_CENTRO = "Juan Ortega";
const RESPONSABLE_GRUA = "Manuel Vargas";
const assignedTag = (name) => `<span class="badge success">Asignado: ${escapeHtml(name)}</span>`;
const initials = (name) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
// Chip de un usuario ya guardado (no un input de texto libre). Se ve como un tag
// con avatar de iniciales y rol; queda pre-seteado. Un input oculto envia el
// valor como "actor" para que el submit (FormData) siga funcionando igual.
const operadorTag = (name) => `<div class="field"><label>Operador</label><div class="user-tag"><span class="user-tag-avatar">${escapeHtml(initials(name))}</span><span class="user-tag-body"><span class="user-tag-name">${escapeHtml(name)}</span><span class="user-tag-role">Operador de turno · puesto de mando</span></span><input type="hidden" name="actor" value="${escapeHtml(name)}"></div></div>`;

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
  toast.classList.toggle("error", error);
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
  const routeChanged = state.renderedRoute !== current;
  if (routeChanged) {
    teardownMap();
    content.innerHTML = '<div class="empty">Cargando datos operacionales…</div>';
  }
  try {
    const renderers = { overview: renderOverview, requests: renderRequests, resources: renderResources, network: renderNetwork, broadcasts: renderBroadcasts, "safe-people": renderSafePeople, simulator: renderSimulator };
    await renderers[current]();
    state.renderedRoute = current;
    if (routeChanged) content.focus({ preventScroll: true });
    return true;
  } catch (error) {
    content.innerHTML = `<div class="panel"><div class="empty">No se pudo cargar: ${escapeHtml(error.message)}</div></div>`;
    return false;
  }
}

async function getOverview() {
  const [overview, offlineMap] = await Promise.all([api("/api/v1/overview"), api("/api/v1/map")]);
  state.overview = overview;
  state.offlineMap = offlineMap;
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
  if (!document.querySelector("#overview-view")) content.innerHTML = `
    <div id="overview-view">
    <div class="page-head"><div><h2>Situación operacional</h2><p>Decisiones pendientes y estado observado de la red.</p></div><div class="page-head-actions"><span id="overview-safe-latest">${latestSafeBadge(data.safe_people)}</span><span id="overview-gateway" class="badge ${data.gateway ? "success" : "warning"}">${data.gateway ? "Gateway conectado" : "Sin radio"}</span></div></div>
    <section id="overview-metrics" class="metrics" aria-label="Métricas accionables">
      ${metric(metrics.critical, "Solicitudes críticas")}${metric(metrics.pending, "Decisiones pendientes")}${metric(metrics.available_resources, "Recursos disponibles")}${metric(metrics.open_requests, "Solicitudes abiertas")}
    </section>
    <div class="grid">
      <section class="panel map-panel"><div class="panel-head"><div><h3>Mapa operacional</h3><span id="map-positions-note" class="muted">${mapPositionsNote(data)}</span></div><div class="panel-actions"><button id="locate-center" class="button" type="button">Usar ubicación actual</button><button id="manual-center" class="button" type="button">Ingresar coordenadas</button></div></div>
        <div class="map-toolbar" aria-label="Controles del mapa">
          <button id="map-toggle-requests" class="button map-toggle" type="button" aria-pressed="true">Solicitudes</button>
          <button id="map-toggle-resources" class="button map-toggle" type="button" aria-pressed="true">Recursos</button>
          <button id="map-fit" class="button" type="button">Encuadrar puntos</button>
           <span id="map-status" class="map-status" role="status">Esquema offline</span>
           <button id="map-download" class="button map-download" type="button" hidden>Descargar mapa offline de Bogotá</button>
           <button id="map-online" class="button map-online" type="button">Activar cartografía online</button>
           <button id="map-offline" class="button" type="button" hidden>Volver al mapa offline</button>
         </div>
         <p id="map-download-status" class="map-download-status" role="status" hidden></p>
        <p id="map-privacy" class="map-privacy">Al activarla se solicitan tiles externos y se comparte el área visible con OpenStreetMap.</p>
        <div id="map" class="map" aria-label="Mapa de solicitudes y recursos"><div class="schematic-context" aria-hidden="true"><span>N</span><i></i></div><span class="map-note">Mapa esquemático offline</span></div>
        <div class="map-legend" aria-label="Leyenda del mapa"><span><i class="legend-shape center"></i>Centro</span><span><i class="legend-shape request"></i>Solicitud</span><span><i class="legend-shape resource"></i>Recurso</span><span><i class="legend-state fresh"></i>Posición y contacto &lt;10 min</span><span><i class="legend-state aging"></i>Posición 10–30 min</span><span><i class="legend-state stale"></i>Dato &gt;30 min</span></div>
      </section>
      <section class="panel"><div class="panel-head"><h3>Cola priorizada</h3><a class="button" href="#requests">Ver todas</a></div><div id="overview-queue" class="list">${overviewQueue(data.requests)}</div></section>
    </div>
    <section class="panel" style="margin-top:16px"><div class="panel-head"><h3>Personas a salvo recientes</h3><a class="button" href="#safe-people">Ver todas</a></div><div id="overview-safe">${safeOverviewList(data.safe_people)}</div></section>
    <section class="panel" style="margin-top:16px"><div class="panel-head"><h3>Actividad reciente de radio</h3><a class="button" href="#network">Abrir red</a></div><div id="overview-radio">${radioTable(data.recent_activity)}</div></section>
    </div>`;
  document.querySelector("#overview-metrics").innerHTML = `${metric(metrics.critical, "Solicitudes críticas")}${metric(metrics.pending, "Decisiones pendientes")}${metric(metrics.available_resources, "Recursos disponibles")}${metric(metrics.open_requests, "Solicitudes abiertas")}`;
  const gatewayBadge = document.querySelector("#overview-gateway");
  gatewayBadge.className = `badge ${data.gateway ? "success" : "warning"}`;
  gatewayBadge.textContent = data.gateway ? "Gateway conectado" : "Sin radio";
  document.querySelector("#overview-safe-latest").innerHTML = latestSafeBadge(data.safe_people);
  document.querySelector("#map-positions-note").textContent = mapPositionsNote(data);
  document.querySelector("#overview-queue").innerHTML = overviewQueue(data.requests);
  document.querySelector("#overview-safe").innerHTML = safeOverviewList(data.safe_people);
  document.querySelector("#overview-radio").innerHTML = radioTable(data.recent_activity);
  document.querySelector("#locate-center").onclick = locateCenter;
  document.querySelector("#manual-center").onclick = enterCenterPosition;
  plotMap(data.requests, data.resources, data.center_position);
  bindRequestRows();
}

function mapPositionsNote(data) { return `Toca un punto para ver detalles · ${centerPositionLabel(data.center_position)}${data.resources_truncated ? ` · mostrando 200 de ${data.resources_total} recursos` : ""}`; }
function overviewQueue(requests) { return requests.length ? requests.slice(0, 7).map(requestListItem).join("") : empty("Sin solicitudes abiertas"); }
function latestSafeBadge(items) {
  if (!items?.length) return "";
  const person = items[0];
  return `<span class="badge success">✓ ${escapeHtml(person.name)} a salvo · ${ago(person.created_at)}</span>`;
}
function safeOverviewList(items) {
  if (!items?.length) return empty("Nadie se ha reportado a salvo todavía");
  return `<div class="list">${items.slice(0, 5).map((item) => {
    const location = validCoordinate(item.lat, item.lon) ? `${item.lat}, ${item.lon}` : (item.place || "Sin ubicación");
    return `<div class="list-item"><div class="list-line"><strong>${escapeHtml(item.name)}</strong><span class="badge success">A salvo</span><span class="mono">${escapeHtml(item.document)}</span></div><div class="cell-sub">${escapeHtml(location)} · nodo ${escapeHtml(item.node)} · ${ago(item.created_at)}</div></div>`;
  }).join("")}</div>`;
}

function centerPositionLabel(position) {
  if (!position) return "Centro sin ubicación · posiciones observadas";
  const accuracy = position.accuracy == null ? "" : ` · ±${Math.round(position.accuracy)} m`;
  return `Centro: ${position.source.toLowerCase()}${accuracy} · ${ago(position.captured_at)}`;
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
  return `<button class="list-item list-button request-row" data-request-id="${item.id}">
    <div class="list-line"><strong>#${item.id} · ${escapeHtml(item.category)}</strong>${priorityBadge(triage.priority)}${stateBadge(item.state)}</div>
    <div>${escapeHtml(item.detail || item.place || "Sin detalle")}</div><div class="cell-sub mono">${escapeHtml(item.node)} · ${ago(item.created_at)}</div>
  </button>`;
}

const hybridMap = {
  map: null,
  element: null,
  markers: new Map(),
  items: [],
  tileLayer: null,
  localLayer: null,
  tileTimer: null,
  tileGeneration: 0,
  camera: null,
  needsInitialFit: true,
  initialFitDone: false,
  mode: "offline",
};

function plotMap(requests, resources, centerPosition) {
  hybridMap.items = [
    ...(centerPosition && validCoordinate(centerPosition.lat, centerPosition.lon) ? [{ ...centerPosition, mapType: "center", key: "center" }] : []),
    ...requests.filter((item) => validCoordinate(item.lat, item.lon)).map((item) => ({ ...item, mapType: "request", key: `request:${item.id}` })),
    ...resources.filter((item) => validCoordinate(item.lat, item.lon)).map((item) => ({ ...item, mapType: "resource", key: `resource:${item.node}` })),
  ];
  const mapElement = document.querySelector("#map");
  if (!mapElement) return;
  if (hybridMap.element !== mapElement) mountHybridMap(mapElement);
  updateMapMarkers();
}

function mountHybridMap(mapElement) {
  teardownMap(true);
  hybridMap.element = mapElement;
  hybridMap.needsInitialFit = !hybridMap.initialFitDone;
  bindMapControls();
  if (!window.L) {
    setMapMode("offline", false);
    renderSchematicMarkers();
    return;
  }
  hybridMap.map = window.L.map(mapElement, { zoomControl: true, attributionControl: true });
  const camera = hybridMap.camera || { center: [4.674, -74.05], zoom: 13 };
  hybridMap.map.setView(camera.center, camera.zoom);
  hybridMap.map.on("moveend zoomend", rememberMapCamera);
  useOfflineBase();
  if (state.onlineMapConsent) tryOnlineTiles();
}

function bindMapControls() {
  const toggles = [["request", "#map-toggle-requests"], ["resource", "#map-toggle-resources"]];
  toggles.forEach(([type, selector]) => {
    const button = document.querySelector(selector);
    button.setAttribute("aria-pressed", String(state.mapFilters[type]));
    button.addEventListener("click", () => {
      state.mapFilters[type] = !state.mapFilters[type];
      button.setAttribute("aria-pressed", String(state.mapFilters[type]));
      updateMapVisibility();
    });
  });
  document.querySelector("#map-fit").addEventListener("click", fitMapPoints);
  document.querySelector("#map-online").addEventListener("click", enableOnlineMap);
  document.querySelector("#map-offline").addEventListener("click", disableOnlineMap);
  document.querySelector("#map-download").addEventListener("click", downloadOfflineMap);
  updateOfflineMapControl();
}

const SHORTBREAD_LIGHT_COLORS = {
  water: "#dbeafe", forest: "#e7eee8", land: "#f1f1ef", site: "#ececea", siteLine: "#dededb",
  building: "#dededb", buildingLine: "#d0d0cc", boundary: "#a3a3a3", waterLine: "#9bc3e6",
  rail: "#a3a3a3", majorRoad: "#8f8f8b", road: "#b8b8b4",
};
const SHORTBREAD_DARK_COLORS = {
  water: "#172b3f", forest: "#172c25", land: "#151a20", site: "#1a2027", siteLine: "#303943",
  building: "#29313a", buildingLine: "#3a4551", boundary: "#697586", waterLine: "#4f83ad",
  rail: "#687483", majorRoad: "#9aa6b3", road: "#687583",
};
let shortbreadColors = document.documentElement.dataset.theme === "dark" ? SHORTBREAD_DARK_COLORS : SHORTBREAD_LIGHT_COLORS;

function shortbreadStyle(properties, zoom, layerName) {
  if (["ocean", "water_polygons"].includes(layerName)) return { fill: true, fillColor: shortbreadColors.water, fillOpacity: 1, stroke: false };
  if (layerName === "land") return { fill: true, fillColor: properties.kind === "forest" ? shortbreadColors.forest : shortbreadColors.land, fillOpacity: .8, stroke: false };
  if (["sites", "street_polygons", "pier_polygons", "dam_polygons"].includes(layerName)) return { fill: true, fillColor: shortbreadColors.site, fillOpacity: .8, color: shortbreadColors.siteLine, weight: .5 };
  if (layerName === "buildings") return { fill: true, fillColor: shortbreadColors.building, fillOpacity: .85, color: shortbreadColors.buildingLine, weight: .5 };
  if (layerName === "boundaries") return { color: shortbreadColors.boundary, weight: 1, dashArray: "4 4", opacity: .7 };
  if (["water_lines", "dam_lines", "pier_lines"].includes(layerName)) return { color: shortbreadColors.waterLine, weight: zoom >= 14 ? 1.4 : 1, opacity: .9 };
  if (["streets", "bridges", "ferries", "aerialways"].includes(layerName)) {
    const major = ["motorway", "trunk", "primary", "secondary"].includes(properties.kind);
    const rail = properties.rail || ["rail", "subway", "tram", "light_rail"].includes(properties.kind);
    return { color: rail ? shortbreadColors.rail : major ? shortbreadColors.majorRoad : shortbreadColors.road, weight: major ? (zoom >= 14 ? 2.6 : 1.8) : (zoom >= 14 ? 1.3 : .8), opacity: rail ? .55 : .92, dashArray: rail ? "3 3" : null };
  }
  return { opacity: 0, fillOpacity: 0, weight: 0, radius: 0 };
}

function useOfflineBase() {
  if (!hybridMap.map) return;
  if (state.offlineMap?.available && window.L.vectorGrid?.protobuf) {
    hybridMap.localLayer = window.L.vectorGrid.protobuf(state.offlineMap.tiles, {
      rendererFactory: window.L.canvas.tile,
      vectorTileLayerStyles: new Proxy({}, { get: (_target, layerName) => (properties, zoom) => shortbreadStyle(properties, zoom, layerName) }),
      minZoom: state.offlineMap.minzoom,
      maxNativeZoom: state.offlineMap.maxNativeZoom,
      maxZoom: state.offlineMap.maxzoom,
      bounds: [[state.offlineMap.bounds[1], state.offlineMap.bounds[0]], [state.offlineMap.bounds[3], state.offlineMap.bounds[2]]],
      attribution: state.offlineMap.attribution,
      interactive: false,
    }).addTo(hybridMap.map);
    if (state.onlineMapConsent && hybridMap.tileLayer) {
      hybridMap.map.removeLayer(hybridMap.localLayer);
      setMapMode(hybridMap.mode);
    } else {
      setMapMode("local");
    }
  } else {
    setMapMode("offline");
  }
}

function enableOnlineMap() {
  state.onlineMapConsent = true;
  sessionStorage.setItem("onlineMapConsent", "true");
  tryOnlineTiles();
}

function disableOnlineMap() {
  state.onlineMapConsent = false;
  sessionStorage.removeItem("onlineMapConsent");
  restoreOfflineBase();
}

function tryOnlineTiles() {
  if (!state.onlineMapConsent || !hybridMap.map || hybridMap.tileLayer) return;
  const generation = ++hybridMap.tileGeneration;
  let consecutiveErrors = 0;
  const layer = window.L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors",
    maxZoom: 19,
  });
  hybridMap.tileLayer = layer;
  if (hybridMap.localLayer) hybridMap.map.removeLayer(hybridMap.localLayer);
  setMapMode("loading");
  layer.on("tileload", () => {
    if (generation !== hybridMap.tileGeneration) return;
    consecutiveErrors = 0;
    clearTimeout(hybridMap.tileTimer);
    setMapMode("online");
  });
  layer.on("tileerror", () => {
    if (generation === hybridMap.tileGeneration && ++consecutiveErrors >= 4) restoreOfflineBase();
  });
  layer.addTo(hybridMap.map);
  clearTimeout(hybridMap.tileTimer);
  hybridMap.tileTimer = setTimeout(() => {
    if (generation === hybridMap.tileGeneration && hybridMap.mode !== "online") restoreOfflineBase();
  }, 7000);
}

function restoreOfflineBase() {
  clearTimeout(hybridMap.tileTimer);
  hybridMap.tileGeneration += 1;
  if (hybridMap.map && hybridMap.tileLayer) hybridMap.map.removeLayer(hybridMap.tileLayer);
  hybridMap.tileLayer = null;
  if (hybridMap.map && hybridMap.localLayer && !hybridMap.map.hasLayer(hybridMap.localLayer)) hybridMap.localLayer.addTo(hybridMap.map);
  setMapMode(hybridMap.localLayer ? "local" : "offline");
}

function degradeToSchematic() { restoreOfflineBase(); }

function setMapMode(mode) {
  hybridMap.mode = mode;
  hybridMap.element?.classList.toggle("cartography-active", mode === "online" || mode === "local");
  const status = document.querySelector("#map-status");
  const online = document.querySelector("#map-online");
  const offline = document.querySelector("#map-offline");
  if (status) status.textContent = mode === "online" ? "Cartografía online" : mode === "local" ? "Mapa offline de Bogotá" : mode === "loading" ? "Cargando cartografía…" : "Esquema offline";
  if (online) online.hidden = state.onlineMapConsent && mode !== "offline";
  if (offline) offline.hidden = !state.onlineMapConsent;
  updateOfflineMapControl();
}

function updateOfflineMapControl() {
  const button = document.querySelector("#map-download");
  const message = document.querySelector("#map-download-status");
  if (!button || !message || !state.offlineMap) return;
  const map = state.offlineMap;
  const panel = document.querySelector(".map-panel");
  panel?.classList.toggle("map-installed", map.available);
  panel?.classList.toggle("map-setup", !map.available);
  button.hidden = map.available || map.downloading;
  button.disabled = map.downloading;
  button.textContent = map.error ? "Reintentar descarga del mapa offline" : "Descargar mapa offline de Bogotá";
  if (map.downloading) {
    const progress = map.progress.percent == null ? map.progress.stage === "cropping" ? `${map.progress.downloaded} tiles` : "Preparando…" : `${map.progress.percent}%`;
    message.textContent = `Mapa offline de Bogotá: ${progress}`;
    message.hidden = false;
  } else if (map.error && !map.available) {
    message.textContent = `No se pudo preparar el mapa: ${map.error}`;
    message.hidden = false;
  } else {
    message.hidden = true;
  }
}

async function downloadOfflineMap() {
  const button = document.querySelector("#map-download");
  button.disabled = true;
  try {
    await api("/api/v1/map/download", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    await pollOfflineMap();
  } catch (error) {
    notify(error.message, true);
    button.disabled = false;
  }
}

async function pollOfflineMap() {
  const previousTiles = state.offlineMap?.tiles;
  state.offlineMap = await api("/api/v1/map");
  updateOfflineMapControl();
  if (state.offlineMap.downloading) {
    setTimeout(() => pollOfflineMap().catch((error) => notify(error.message, true)), 1000);
  } else if (state.offlineMap.available) {
    notify("Mapa offline de Bogotá listo");
    if (hybridMap.map && previousTiles !== state.offlineMap.tiles) {
      if (hybridMap.localLayer) hybridMap.map.removeLayer(hybridMap.localLayer);
      hybridMap.localLayer = null;
      useOfflineBase();
    }
  }
}

function updateMapMarkers() {
  if (!hybridMap.map) {
    renderSchematicMarkers();
    return;
  }
  const activeKeys = new Set(hybridMap.items.map((item) => item.key));
  hybridMap.markers.forEach((record, key) => {
    if (!activeKeys.has(key)) {
      record.marker.remove();
      hybridMap.markers.delete(key);
    }
  });
  hybridMap.items.forEach((item) => {
    const visualSignature = mapItemVisualSignature(item);
    const contentSignature = mapItemContentSignature(item);
    let record = hybridMap.markers.get(item.key);
    if (!record) {
      const marker = createLeafletMarker(item);
      record = { marker, item, visualSignature, contentSignature, positionSignature: mapItemPositionSignature(item) };
      hybridMap.markers.set(item.key, record);
    } else {
      const wasFresh = markerFreshness(record.item) === "fresh";
      const positionSignature = mapItemPositionSignature(item);
      const animateFresh = markerFreshness(item) === "fresh" && (!wasFresh || record.positionSignature !== positionSignature);
      record.item = item;
      record.marker._operationalItem = item;
      if (record.visualSignature !== visualSignature || animateFresh) {
        record.marker.setLatLng([Number(item.lat), Number(item.lon)]);
        record.marker.setIcon(markerIcon(item, false, animateFresh));
        configureMarkerElement(record.marker);
        record.visualSignature = visualSignature;
      }
      if (record.contentSignature !== contentSignature) {
        configureMarkerElement(record.marker);
        record.marker.setPopupContent(mapPopup(item));
        record.contentSignature = contentSignature;
      }
      record.positionSignature = positionSignature;
    }
  });
  updateMapVisibility();
  if (hybridMap.needsInitialFit) {
    if (fitMapPoints()) {
      hybridMap.needsInitialFit = false;
      hybridMap.initialFitDone = true;
    }
  }
}

function createLeafletMarker(item) {
  const label = markerLabel(item);
  const marker = window.L.marker([Number(item.lat), Number(item.lon)], {
    icon: markerIcon(item, true, true), keyboard: true, title: label, alt: label, riseOnHover: true,
  });
  marker._operationalItem = item;
  marker.on("add", () => configureMarkerElement(marker));
  marker.bindPopup(mapPopup(item), { className: "resource-popup", closeButton: true, maxWidth: 310 });
  marker.on("popupopen", () => {
    const button = marker.getPopup()?.getElement()?.querySelector(".map-popup-open-request");
    if (button) button.onclick = () => openRequest(Number(marker._operationalItem.id));
  });
  return marker;
}

function configureMarkerElement(marker) {
  const element = marker.getElement();
  if (!element) return;
  element.setAttribute("aria-label", markerLabel(marker._operationalItem));
  element.setAttribute("role", "button");
  if (element.dataset.operationalMarker === "true") return;
  element.dataset.operationalMarker = "true";
  element.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); marker.fire("click"); }
  });
}

function markerIcon(item, animateCritical, animateFresh = false) {
  const classes = ["operational-marker", item.mapType, markerFreshness(item)];
  if (animateCritical && item.mapType === "request" && (item.triage?.priority ?? item.priority) === 0 && ageSeconds(item.created_at) < 600) classes.push("critical-new");
  if (animateFresh && item.mapType === "resource" && markerFreshness(item) === "fresh") classes.push("fresh-animate");
  return window.L.divIcon({ className: classes.join(" "), html: "<span></span>", iconSize: [44, 44], iconAnchor: [22, 22], popupAnchor: [0, -22] });
}

function mapItemVisualSignature(item) { return [item.lat, item.lon, item.state, item.priority, item.triage?.priority, markerFreshness(item)].join("|"); }
function mapItemPositionSignature(item) { return [item.lat, item.lon, item.position_seen_at].join("|"); }
function mapItemContentSignature(item) { return `${markerLabel(item)}|${mapPopup(item)}`; }

function markerFreshness(item) {
  if (item.mapType !== "resource") return "";
  const positionAge = ageSeconds(item.position_seen_at);
  const contactAge = ageSeconds(item.last_seen);
  if (positionAge > 1800 || contactAge > 1800) return "stale";
  if (positionAge >= 600) return "aging";
  if (positionAge < 600 && contactAge < 600) return "fresh";
  return "recent-static";
}

function markerLabel(item) {
  if (item.mapType === "request") return `Solicitud #${item.id}, ${item.category || "sin categoría"}, prioridad ${item.triage?.priority ?? item.priority}`;
  if (item.mapType === "center") return `${item.label || "Centro de comando"}, ubicación ${item.source.toLowerCase()}`;
  return `Recurso ${item.node}, ${item.state || "sin estado"}, posición ${ago(item.position_seen_at)}`;
}

function mapPopup(item) {
  if (item.mapType === "center") return `<div class="map-popup" tabindex="-1"><span class="map-popup-kicker">Centro de comando</span><strong>${escapeHtml(item.label || "Centro de comando")}</strong><dl><dt>Fuente</dt><dd>${escapeHtml((item.source || "configurada").toLowerCase())}</dd><dt>Capturada</dt><dd>${ago(item.captured_at)}</dd><dt>Coordenadas</dt><dd class="mono">${escapeHtml(item.lat)}, ${escapeHtml(item.lon)}</dd></dl></div>`;
  if (item.mapType === "request") {
    const priority = item.triage?.priority ?? item.priority;
    return `<div class="map-popup request-popup" tabindex="-1"><span class="map-popup-kicker">Solicitud #${item.id} · ${ago(item.created_at)}</span><strong>${escapeHtml(item.category || "Sin categoría")}</strong><p>${escapeHtml(item.detail || item.place || "Sin detalle reportado")}</p><dl><dt>Estado</dt><dd>${escapeHtml(item.state || "PENDIENTE")}</dd><dt>Prioridad</dt><dd>${escapeHtml(priority)}</dd><dt>Nodo</dt><dd class="mono">${escapeHtml(item.node)}</dd><dt>Ubicación</dt><dd>${escapeHtml(item.place || `${item.lat}, ${item.lon}`)}</dd><dt>RSSI / SNR</dt><dd class="mono">${escapeHtml(item.rssi || "Sin dato")} / ${escapeHtml(item.snr || "Sin dato")}</dd>${item.resource_node ? `<dt>Asignado</dt><dd class="mono">${escapeHtml(item.resource_node)}</dd>` : ""}</dl><button class="button map-popup-open-request" type="button">Ver solicitud completa</button></div>`;
  }
  return `<div class="map-popup" tabindex="-1"><span class="map-popup-kicker">Recurso conectado</span><strong class="mono">${escapeHtml(item.node)}</strong><dl><dt>Tipo</dt><dd>${escapeHtml(item.kind || "Sin definir")}</dd><dt>Estado</dt><dd>${escapeHtml(item.state || "Sin dato")}</dd><dt>Zona</dt><dd>${escapeHtml(item.zone || "Sin asignar")}</dd><dt>Contacto</dt><dd>${ago(item.last_seen)}</dd><dt>Posición</dt><dd>${ago(item.position_seen_at)}</dd><dt>RSSI / SNR</dt><dd class="mono">${escapeHtml(item.rssi || "Sin dato")} / ${escapeHtml(item.snr || "Sin dato")}</dd></dl></div>`;
}

function updateMapVisibility() {
  if (!hybridMap.map) {
    renderSchematicMarkers();
    return;
  }
  hybridMap.markers.forEach((record) => {
    const visible = record.item.mapType === "center" || state.mapFilters[record.item.mapType];
    if (visible && !hybridMap.map.hasLayer(record.marker)) record.marker.addTo(hybridMap.map);
    if (!visible && hybridMap.map.hasLayer(record.marker)) record.marker.remove();
  });
}

function renderSchematicMarkers() {
  if (!hybridMap.element) return;
  hybridMap.element.querySelectorAll(".map-dot").forEach((marker) => marker.remove());
  const items = hybridMap.items.filter((item) => item.mapType === "center" || state.mapFilters[item.mapType]);
  if (!items.length) return;
  const lats = items.map((item) => Number(item.lat));
  const lons = items.map((item) => Number(item.lon));
  const minLat = Math.min(...lats) - .001;
  const maxLat = Math.max(...lats) + .001;
  const minLon = Math.min(...lons) - .001;
  const maxLon = Math.max(...lons) + .001;
  items.forEach((item) => {
    const marker = document.createElement("button");
    marker.type = "button";
    marker.className = `map-dot ${item.mapType} ${markerFreshness(item)}`;
    if (item.mapType === "request" && (item.triage?.priority ?? item.priority) === 0 && ageSeconds(item.created_at) < 600) marker.classList.add("critical-new");
    marker.style.left = `${6 + 88 * ((Number(item.lon) - minLon) / (maxLon - minLon))}%`;
    marker.style.top = `${6 + 84 * (1 - (Number(item.lat) - minLat) / (maxLat - minLat))}%`;
    marker.setAttribute("aria-label", markerLabel(item));
    marker.title = markerLabel(item);
    marker.addEventListener("click", () => item.mapType === "request" ? openRequest(Number(item.id)) : showOfflineMapItem(item));
    hybridMap.element.appendChild(marker);
  });
}

function showOfflineMapItem(item) {
  if (item.mapType === "center") {
    notify(`${item.label || "Centro de comando"} · ubicación ${item.source.toLowerCase()} · ${ago(item.captured_at)}`);
    return;
  }
  notify(`${item.node} · ${item.state || "Sin estado"} · contacto ${ago(item.last_seen)} · posición ${ago(item.position_seen_at)}`);
}

function fitMapPoints() {
  const visible = hybridMap.items.filter((item) => item.mapType === "center" || state.mapFilters[item.mapType]);
  if (!hybridMap.map || !visible.length) return false;
  const points = visible.map((item) => [Number(item.lat), Number(item.lon)]);
  if (points.length === 1) hybridMap.map.setView(points[0], 15);
  else hybridMap.map.fitBounds(points, { padding: [36, 36], maxZoom: 16 });
  rememberMapCamera();
  return true;
}

function rememberMapCamera() {
  if (!hybridMap.map) return;
  const center = hybridMap.map.getCenter();
  hybridMap.camera = { center: [center.lat, center.lng], zoom: hybridMap.map.getZoom() };
}

function teardownMap(preserveElement = false) {
  clearTimeout(hybridMap.tileTimer);
  hybridMap.tileGeneration += 1;
  if (hybridMap.map) {
    rememberMapCamera();
    hybridMap.map.off();
    hybridMap.map.remove();
  }
  hybridMap.map = null;
  hybridMap.tileLayer = null;
  hybridMap.localLayer = null;
  hybridMap.markers.clear();
  hybridMap.mode = "offline";
  if (!preserveElement) hybridMap.element = null;
}

function ageSeconds(value) { return value ? Math.max(0, Date.now() / 1000 - Number(value)) : Infinity; }
function validCoordinate(lat, lon) {
  if (lat === "" || lat == null || lon === "" || lon == null) return false;
  const latitude = Number(lat);
  const longitude = Number(lon);
  return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

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
    // El operador elige de la lista de recursos COMPATIBLES y disponibles (el
    // candado del backend exige que el tipo del recurso coincida con la categoría).
    const canDispatch = ["PENDIENTE", "EN_REVISION"].includes(request.state) && !request.resource_node && triage.candidates.length;
    document.querySelector("#drawer-content").innerHTML = `
      <section class="detail-section"><h3>Solicitud #${request.id}</h3><dl class="key-values"><dt>Categoría</dt><dd>${escapeHtml(request.category)}</dd><dt>Estado</dt><dd>${stateBadge(request.state)}</dd><dt>Responsable</dt><dd>${assignedTag(RESPONSABLE_GRUA)}</dd><dt>Origen</dt><dd class="mono">${escapeHtml(request.node)} / ${request.seq}</dd><dt>Lugar</dt><dd>${escapeHtml(request.place || "Sin lugar")}</dd><dt>GPS</dt><dd>${validCoordinate(request.lat, request.lon) ? `<span class="mono">${escapeHtml(request.lat)}, ${escapeHtml(request.lon)}</span> · <a href="#overview" class="link">Ver en el mapa</a>` : "Sin GPS"}</dd><dt>Detalle</dt><dd>${escapeHtml(request.detail || "Sin detalle")}</dd><dt>Radio</dt><dd class="mono">RSSI ${escapeHtml(request.rssi || "—")} · SNR ${escapeHtml(request.snr || "—")}</dd></dl></section>
      <section class="detail-section"><h3>Triage explicable</h3><div class="review"><div class="list-line">${priorityBadge(triage.priority)} <span class="muted">Reportada: ${request.priority}</span></div><p>${triage.reasons.map(escapeHtml).join(" · ")}</p>${triage.alerts.length ? `<p class="badge warning">${triage.alerts.map(escapeHtml).join(" · ")}</p>` : ""}</div></section>
      <section class="detail-section"><h3>Candidatos</h3>${triage.candidates.length ? `<div class="list">${triage.candidates.map((item) => `<div class="list-item"><strong class="mono">${escapeHtml(item.node)}</strong><div class="cell-sub">${item.distance_km == null ? "Posición no reciente" : `${item.distance_km} km`} · contacto hace ${item.last_seen_seconds} s</div></div>`).join("")}</div>` : empty("Sin candidatos elegibles")}</section>
      ${canDispatch ? dispatchForm(request, triage.candidates, triage.recommended_resource.node) : ""}
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
function dispatchForm(request, candidates, suggested) {
  // El operador ELIGE la unidad de la lista de disponibles y compatibles (la más
  // cercana primero; la recomendada por el triage viene pre-seleccionada).
  const options = candidates.map((c) => {
    const dist = c.distance_km == null ? "posición no reciente" : `${c.distance_km} km`;
    const selected = c.node === suggested ? " selected" : "";
    return `<option value="${escapeHtml(c.node)}"${selected}>${escapeHtml(c.node)} · ${escapeHtml(dist)}</option>`;
  }).join("");
  return `<section class="detail-section"><h3>Solicitar grúa</h3><form id="dispatch-form" data-request-id="${request.id}" class="review"><div class="field"><label for="resource-node">Grúa disponible y compatible</label><select id="resource-node" name="resource_node" required>${options}</select></div>${operadorTag(OPERADOR_CENTRO)}<div class="field"><label for="dispatch-reason">Motivo</label><textarea id="dispatch-reason" name="reason" maxlength="240" placeholder="Justificación operacional"></textarea></div><label class="list-line" style="margin-top:10px"><input name="confirmed" type="checkbox" required style="width:20px;min-height:20px"> Confirmo que revisé solicitud, prioridad y recurso.</label><div class="form-actions"><button class="button action" type="submit">Solicitar a la grúa</button></div></form></section>`;
}
function humanActions(request) {
  const actions = [];
  if (request.state === "PENDIENTE") actions.push(["review", "Tomar la tarea (en proceso)"]);
  if (request.state === "ENVIO_INDETERMINADO") actions.push(["release", "Liberar recurso y reabrir"]);
  if (["PENDIENTE", "EN_REVISION"].includes(request.state) && !request.resource_node) actions.push(["cancel", "Cancelar"]);
  if (["ACEPTADA", "EN_CURSO"].includes(request.state)) actions.push(["resolve", "Resolver"]);
  if (!actions.length) return "";
  return `<section class="detail-section"><h3>Acción humana</h3><form id="action-form" data-request-id="${request.id}" class="review"><div class="field"><label for="action">Acción</label><select id="action" name="action">${actions.map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select></div>${operadorTag(OPERADOR_CENTRO)}<div class="field"><label for="action-reason">Motivo obligatorio</label><textarea id="action-reason" name="reason" required minlength="3" maxlength="240"></textarea></div><div class="form-actions"><button class="button" type="submit">Registrar acción</button></div></form></section>`;
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
  const button = event.currentTarget.querySelector("button[type=submit]");
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "Enviando…";
  const values = Object.fromEntries(new FormData(event.currentTarget));
  try {
    await api(`/api/v1/requests/${event.currentTarget.dataset.requestId}/actions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
    notify("Acción registrada en el timeline"); closeDrawer(); await refreshCurrent();
  } catch (error) { notify(error.message, true); button.disabled = false; button.textContent = originalText; }
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
function broadcastList(items) { return items.length ? `<div class="list">${items.map((item) => `<button class="list-item list-button broadcast-detail" data-id="${item.message_id}"><div class="list-line"><strong class="mono">#${item.message_id}</strong><span class="badge">${escapeHtml(item.scope)}</span><span class="badge ${item.priority === "URGENT" ? "critical" : ""}">${escapeHtml(item.priority)}</span><span class="badge">${escapeHtml(item.status)}</span></div><div>${escapeHtml(item.message)}</div><div class="cell-sub">${item.received_count} recibos técnicos · ${ago(item.created_at)}</div></button>`).join("")}</div>` : empty("Sin broadcasts enviados"); }
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
window.addEventListener("command-center-themechange", (event) => {
  const theme = event.detail.theme;
  shortbreadColors = theme === "dark" ? SHORTBREAD_DARK_COLORS : SHORTBREAD_LIGHT_COLORS;
  hybridMap.localLayer?.redraw();
});

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
let eventSource = null;
let sseRefreshTimer = null;
let sseUpdatePending = false;
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
  eventSource = new EventSource("/api/v1/events");
  eventSource.addEventListener("update", scheduleSseRefresh);
  eventSource.addEventListener("open", () => { sseHealthy = true; stopPolling(); document.querySelector("#live-badge").textContent = "En vivo"; });
  eventSource.addEventListener("ready", () => { sseHealthy = true; stopPolling(); document.querySelector("#live-badge").textContent = "En vivo"; });
  eventSource.onerror = () => { sseHealthy = false; startPolling(pollDelay); };
}

function scheduleSseRefresh() {
  sseUpdatePending = true;
  if (!sseRefreshTimer) sseRefreshTimer = setTimeout(flushSseRefresh, 350);
}

async function flushSseRefresh() {
  sseRefreshTimer = null;
  sseUpdatePending = false;
  const refreshed = await refreshCurrent();
  if (!refreshed) sseUpdatePending = true;
  if (sseUpdatePending) scheduleSseRefresh();
}

window.addEventListener("pagehide", () => {
  clearTimeout(sseRefreshTimer);
  clearTimeout(hybridMap.tileTimer);
  sseRefreshTimer = null;
  stopPolling();
  eventSource?.close();
});

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
