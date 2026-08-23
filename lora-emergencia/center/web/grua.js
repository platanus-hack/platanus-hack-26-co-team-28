// App del operador de grúa (simulador sin 3ra placa). Se carga como script
// externo (no inline) para que la automatización/CDP pueda ejercerla, igual que
// el dashboard (app.js). Envía frames ACC/ST por el simulador del centro.
const resource = "GRUA07";
const token = sessionStorage.getItem("apiToken") || "";
const SERVICIO_KEY = "grua_en_servicio";
let enServicio = false;
let hbTimer = null;
let messageId = Date.now() % 1000000;
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char]));

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(path, { ...options, headers });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "No se pudo completar la acción");
  return data;
}

function frame(kind, payload) {
  messageId += 1;
  return `${resource}|CENTRO|${kind}|${messageId}|${payload.join("|")}`;
}

async function sendFrame(kind, payload) {
  await api("/api/v1/simulator/frames", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ frame: frame(kind, payload) }),
  });
}

// El operador de grúa entra/sale de servicio a propósito (como una unidad que
// reporta disponibilidad). Entrar manda un HB que registra la grúa como RESCATE
// disponible; un latido periódico la mantiene reciente para el triage. El estado
// se recuerda en el navegador, así una recarga NO cae a "fuera de servicio".
async function entrarServicio() {
  try {
    await sendFrame("HB", ["RESCATE", "NORTE", "-", "1"]);
    enServicio = true;
    try { localStorage.setItem(SERVICIO_KEY, "1"); } catch (e) { /* almacenamiento no disponible */ }
    setStatus("En servicio · esperando asignaciones", "ok");
    const btn = document.querySelector("#connect");
    btn.textContent = "Salir de servicio";
    btn.className = "btn salir";
    document.querySelector("#error").textContent = "";
    if (hbTimer) clearInterval(hbTimer);
    hbTimer = setInterval(() => { sendFrame("HB", ["RESCATE", "NORTE", "-", "1"]).catch(() => {}); }, 60000);
    tick();
  } catch (error) {
    document.querySelector("#error").textContent = error.message;
  }
}

function salirServicio() {
  enServicio = false;
  try { localStorage.removeItem(SERVICIO_KEY); } catch (e) { /* almacenamiento no disponible */ }
  if (hbTimer) { clearInterval(hbTimer); hbTimer = null; }
  setStatus("Fuera de servicio", "");
  const btn = document.querySelector("#connect");
  btn.textContent = "Entrar en servicio";
  btn.className = "btn conn";
  document.querySelector("#list").innerHTML = "";
}

function toggleServicio() {
  if (enServicio) salirServicio(); else entrarServicio();
}

async function update(kind, node, sequence, state = "") {
  try {
    await sendFrame(kind, state ? [node, sequence, state] : [node, sequence]);
    document.querySelector("#error").textContent = "";
    tick();
  } catch (error) {
    document.querySelector("#error").textContent = error.message;
  }
}

function setStatus(text, kind) {
  const dot = document.querySelector("#status-dot");
  const label = document.querySelector("#status");
  if (label) label.textContent = text;
  if (dot) dot.className = "dot " + (kind || "");
}

// El operador ve el PROTOCOLO (ACC/ST), no jerga tipo "viaje". El ciudadano ve
// texto simple; el mando y los recursos ven el protocolo exacto del request.
// Los botones usan data-* + event delegation (no onclick inline), igual que el
// dashboard: asi funcionan de forma fiable, tambien bajo automatizacion/CDP.
function actions(request) {
  const n = escapeHtml(request.node), s = escapeHtml(String(request.seq));
  if (request.estado === "DESPACHADA") return `<button class="btn accept" data-kind="ACC" data-node="${n}" data-seq="${s}">Aceptar asignación · ACC → ACEPTADA</button>`;
  if (request.estado === "ACEPTADA") return `<button class="btn route" data-kind="ST" data-node="${n}" data-seq="${s}" data-state="enruta">En ruta · ST enruta → EN_CURSO</button>`;
  if (request.estado === "EN_CURSO") return `<button class="btn place" data-kind="ST" data-node="${n}" data-seq="${s}" data-state="enlugar">En el lugar · ST enlugar</button><button class="btn resolve" data-kind="ST" data-node="${n}" data-seq="${s}" data-state="resuelta">Resuelta · ST resuelta → RESUELTA</button>`;
  return "";
}

async function tick() {
  if (!enServicio) return;
  try {
    const data = await api("/api/state");
    const requests = (data.requests || []).filter((request) => request.operador === resource && !["RESUELTA", "CANCELADA"].includes(request.estado));
    document.querySelector("#list").innerHTML = requests.length ? requests.map((request) => {
      const location = request.lat && request.lon ? `${request.lat}, ${request.lon}` : (request.lugar || "sin ubicación");
      const mapa = request.lat && request.lon ? ` · <a class="maplink" target="_blank" href="https://www.google.com/maps?q=${encodeURIComponent(request.lat + "," + request.lon)}">ver mapa</a>` : "";
      return `<section class="card">
        <div class="cardhead"><span class="cat">${escapeHtml(request.cat)}</span><span class="pill p${request.pri}">Prioridad ${request.pri}</span></div>
        <div class="loc"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/><circle cx="12" cy="10" r="2"/></svg><span>${escapeHtml(location)}${mapa}</span></div>
        <div class="meta">${escapeHtml(request.detalle || "-")}<br><span class="muted">de ${escapeHtml(request.node)}</span></div>
        <span class="state">${escapeHtml(request.estado)}</span>
        ${actions(request)}
      </section>`;
    }).join("") : '<div class="empty">En servicio. Sin asignaciones por ahora.</div>';
  } catch (error) {
    document.querySelector("#error").textContent = error.message;
  }
}

document.querySelector("#connect").addEventListener("click", toggleServicio);
// Event delegation para los botones de accion (ACC/ST), que se generan dinamicamente.
document.querySelector("#list").addEventListener("click", (event) => {
  const btn = event.target.closest("button[data-kind]");
  if (!btn) return;
  update(btn.dataset.kind, btn.dataset.node, btn.dataset.seq, btn.dataset.state || "");
});
setInterval(tick, 2000);
// Al cargar: si el operador ya estaba en servicio, lo retomamos (reenvia el HB).
try { if (localStorage.getItem(SERVICIO_KEY) === "1") entrarServicio(); } catch (e) { /* sin almacenamiento */ }
