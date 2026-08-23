// App del operador de un recurso (simulador sin una placa por unidad). Se carga
// como script externo (no inline) para que la automatización/CDP pueda
// ejercerla, igual que el dashboard (app.js). Envía frames ACC/ST por el
// simulador del centro.
//
// Sirve para CUALQUIER recurso, no solo la grúa: /grua?nodo=MEDICO01 opera esa
// ambulancia. Sin el parámetro abre GRUA07, que es el comportamiento de antes.
// Sin esto, despachar a un recurso sin app dejaba la solicitud en DESPACHADA
// para siempre: nadie podía aceptarla y el ciudadano se quedaba en "Ayuda en
// camino".
const resource = (new URLSearchParams(location.search).get("nodo") || "GRUA07").toUpperCase();
// Quién opera esta unidad. La tabla vive en operadores.js, compartida con el
// dashboard, para que el nombre no quede duplicado en 2 archivos.
const operador = window.operadorDe(resource);
const tituloRecurso = `${operador.nombre} · ${resource}`;
const token = sessionStorage.getItem("apiToken") || "";
// La clave lleva el nodo: entrar en servicio con una ambulancia no debe cambiar
// el estado de la grúa en el mismo navegador.
const SERVICIO_KEY = `servicio_${resource}`;
let enServicio = false;
let hbTimer = null;
// Categorías que atiende este recurso. Se leen del centro al arrancar, así el
// latido no las degrada (hardcodear "GRUA,RESCATE" borraba el tipo real de
// cualquier otro nodo).
let resourceKind = "GRUA,RESCATE";
let resourceZone = "NORTE";
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

// El operador entra/sale de servicio a propósito (como una unidad que reporta
// disponibilidad). Entrar manda un HB que registra el recurso como disponible
// con SUS categorías (leídas del centro, no fijas); un latido periódico lo
// mantiene reciente para el triage, que descarta lo que lleve más de 10 min
// sin contacto. El estado se recuerda en el navegador, así una recarga NO cae
// a "fuera de servicio".
async function entrarServicio() {
  try {
    await sendFrame("HB", [resourceKind, resourceZone, "-", "1"]);
    enServicio = true;
    try { localStorage.setItem(SERVICIO_KEY, "1"); } catch (e) { /* almacenamiento no disponible */ }
    setStatus("En servicio · esperando asignaciones", "ok");
    const btn = document.querySelector("#connect");
    btn.textContent = "Salir de servicio";
    btn.className = "btn salir";
    document.querySelector("#error").textContent = "";
    if (hbTimer) clearInterval(hbTimer);
    hbTimer = setInterval(() => { sendFrame("HB", [resourceKind, resourceZone, "-", "1"]).catch(() => {}); }, 60000);
    tick();
  } catch (error) {
    document.querySelector("#error").textContent = error.message;
    // Restaura el boton si no se pudo entrar en servicio (toggleServicio lo
    // habia puesto en "…").
    const btn = document.querySelector("#connect");
    btn.textContent = "Entrar en servicio";
    btn.className = "btn conn";
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

// Feedback al pulsar entrar/salir de servicio. Usa conBoton() (ui.js), el
// mismo helper del dashboard: deshabilita, dice QUE esta haciendo y marca
// aria-busy. Antes mostraba solo "…", que no dice nada.
// conBoton() restaura el texto que habia ANTES del clic; aqui el texto correcto
// depende del resultado (entro o no entro), asi que se fija al final.
async function toggleServicio() {
  const btn = document.querySelector("#connect");
  const entrando = !enServicio;
  await window.conBoton(btn, entrando ? "Entrando en servicio…" : "Saliendo…", async () => {
    if (entrando) await entrarServicio(); else salirServicio();
  });
  btn.textContent = enServicio ? "Salir de servicio" : "Entrar en servicio";
  btn.className = enServicio ? "btn salir" : "btn conn";
}

// update() devuelve true si el frame salio bien y false si fallo. El listener de
// #list usa ese valor para re-habilitar el boton cuando hay error. La firma
// (kind, node, sequence, state) no cambia.
async function update(kind, node, sequence, state = "") {
  try {
    await sendFrame(kind, state ? [node, sequence, state] : [node, sequence]);
    document.querySelector("#error").textContent = "";
    tick();
    return true;
  } catch (error) {
    document.querySelector("#error").textContent = error.message;
    return false;
  }
}

// Confirmacion breve tras una accion exitosa. Crea un toast fijo abajo, lo
// muestra y lo oculta a los ~2.5s. Usa los tokens dark de grua.html.
let toastTimer = null;
function showToast(message) {
  let toast = document.querySelector("#toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    toast.className = "toast";
    // role/aria-live: un lector de pantalla anuncia la confirmacion sin robar
    // el foco. Igual que el toast del dashboard (index.html).
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("show");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.classList.remove("show"); }, 2500);
}

function toastMessage(kind, state) {
  if (kind === "ACC") return "Aceptaste la asignación";
  if (kind === "ST" && state === "enruta") return "Marcaste en ruta";
  if (kind === "ST" && state === "enlugar") return "Marcaste en el lugar";
  if (kind === "ST" && state === "resuelta") return "Caso resuelto";
  return "Acción enviada";
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
document.querySelector("#list").addEventListener("click", async (event) => {
  const btn = event.target.closest("button[data-kind]");
  if (!btn || btn.disabled) return;
  // Feedback inmediato con conBoton() (ui.js): deshabilita, dice "Enviando…" y
  // marca aria-busy. La clase .sending baja la opacidad, que conBoton() no toca.
  const kind = btn.dataset.kind;
  const btnState = btn.dataset.state || "";
  btn.classList.add("sending");
  const ok = await window.conBoton(btn, "Enviando…", () => update(kind, btn.dataset.node, btn.dataset.seq, btnState));
  btn.classList.remove("sending");
  // Si salio, tick() ya refresco la lista (el boton desaparece) y confirmamos
  // con el toast. Si fallo, #error muestra el motivo y el boton vuelve solo.
  if (ok) showToast(toastMessage(kind, btnState));
});
setInterval(tick, 2000);

// Arranque: pone el nombre del recurso en pantalla y lee sus categorías reales
// del centro, para que el latido no las degrade. Si el recurso no existe
// todavía, se queda con los valores por defecto y el HB lo registra.
async function iniciar() {
  document.title = tituloRecurso;
  const titulo = document.querySelector("#titulo");
  if (titulo) titulo.textContent = tituloRecurso;
  try {
    const data = await api("/api/v1/resources");
    const encontrado = (data.items || []).find((item) => item.node === resource);
    if (encontrado) {
      if (encontrado.kind) resourceKind = encontrado.kind;
      if (encontrado.zone) resourceZone = encontrado.zone;
      const sub = document.querySelector("#subtitulo");
      if (sub) sub.textContent = `${operador.rol} · ${resourceKind}`;
    }
  } catch (error) { /* el centro dirá el motivo al entrar en servicio */ }
  // Si el operador ya estaba en servicio, lo retomamos (reenvía el HB).
  try { if (localStorage.getItem(SERVICIO_KEY) === "1") entrarServicio(); } catch (e) { /* sin almacenamiento */ }
}
iniciar();
