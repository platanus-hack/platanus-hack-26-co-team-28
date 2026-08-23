"use strict";

const portalLogic = window.WokiResourcePortal;
const elements = {
  resource: document.querySelector("#resource"),
  meta: document.querySelector("#meta"),
  assignment: document.querySelector("#assignment"),
  assignmentMeta: document.querySelector("#assignment-meta"),
  broadcastCard: document.querySelector("#broadcast-card"),
  broadcast: document.querySelector("#broadcast"),
  connectionDot: document.querySelector("#connection-dot"),
  connectionText: document.querySelector("#connection-text"),
  enableAlerts: document.querySelector("#enable-alerts"),
  call: document.querySelector("#incoming-call"),
  callKind: document.querySelector("#call-kind"),
  callMessage: document.querySelector("#call-message"),
  acceptCall: document.querySelector("#accept-call"),
  enableCallAudio: document.querySelector("#enable-call-audio"),
  silenceCall: document.querySelector("#silence-call"),
  toast: document.querySelector("#toast"),
};

let cursor = {};
let currentState = null;
let currentAlert = null;
let alertQueue = [];
let audioContext = null;
let ringTimer = null;
let polling = false;

function notify(message) {
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => { elements.toast.hidden = true; }, 3500);
}

function audioReady() {
  return audioContext && audioContext.state === "running";
}

function pulseTone(frequency, delaySeconds) {
  if (!audioReady()) return;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const start = audioContext.currentTime + delaySeconds;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.16, start + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(start);
  oscillator.stop(start + 0.24);
}

function ringOnce() {
  pulseTone(740, 0);
  pulseTone(940, 0.28);
}

function startRing() {
  stopRing();
  if (!audioReady()) return;
  ringOnce();
  ringTimer = setInterval(ringOnce, 1550);
}

function stopRing() {
  clearInterval(ringTimer);
  ringTimer = null;
  window.speechSynthesis?.cancel();
  navigator.vibrate?.(0);
}

function speak(message) {
  if (!audioReady() || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(message);
  utterance.lang = "es-CO";
  utterance.rate = 0.96;
  const spanishVoice = window.speechSynthesis.getVoices().find((voice) => voice.lang.toLowerCase().startsWith("es"));
  if (spanishVoice) utterance.voice = spanishVoice;
  window.speechSynthesis.speak(utterance);
}

async function enableAudio() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) {
    notify("Este navegador no permite alertas de audio");
    return false;
  }
  audioContext ||= new AudioContext();
  await audioContext.resume();
  pulseTone(880, 0);
  elements.enableAlerts.textContent = "✓ Llamadas operativas activas";
  elements.enableAlerts.disabled = true;
  elements.enableCallAudio.hidden = true;
  if (currentAlert) {
    startRing();
    speak(currentAlert.announcement);
  }
  return true;
}

function renderState(state) {
  elements.resource.textContent = `${state.resource} · ${state.type}`;
  elements.meta.textContent = `${state.zone} · ${state.assignmentState.replaceAll("_", " ")}`;
  elements.assignment.textContent = state.category
    ? `${state.category} — ${state.detail || state.place || "sin detalle"}`
    : "Sin asignación";
  elements.assignmentMeta.textContent = state.category
    ? `Prioridad ${state.priority || "—"}${state.place ? ` · ${state.place}` : ""}`
    : "";
  elements.broadcastCard.hidden = !state.broadcast;
  elements.broadcastCard.classList.toggle("urgent", state.broadcastPriority === "URGENT");
  elements.broadcast.textContent = state.broadcast || "";
  const enabledActions = {
    accept: state.assignmentState === "PENDIENTE_ACEPTAR",
    enruta: state.assignmentState === "ACEPTADA",
    enlugar: state.assignmentState === "EN_RUTA",
    resuelta: state.assignmentState === "EN_RUTA" || state.assignmentState === "EN_LUGAR",
  };
  document.querySelectorAll("[data-action]").forEach((button) => {
    button.disabled = !enabledActions[button.dataset.action];
  });
}

function showNextAlert() {
  if (currentAlert || !alertQueue.length) return;
  currentAlert = alertQueue.shift();
  const assignment = currentAlert.kind === "assignment";
  elements.callKind.textContent = assignment ? "Nueva asignación del centro" : "Broadcast del centro";
  elements.callMessage.textContent = currentAlert.announcement;
  elements.acceptCall.hidden = !assignment;
  elements.enableCallAudio.hidden = audioReady();
  elements.call.hidden = false;
  navigator.vibrate?.(assignment ? [300, 160, 300, 160, 650] : [220, 120, 220]);
  if (audioReady()) {
    startRing();
    speak(currentAlert.announcement);
  }
}

function closeAlert() {
  stopRing();
  elements.call.hidden = true;
  currentAlert = null;
  showNextAlert();
}

async function act(action) {
  const response = await fetch(`/api/action?state=${encodeURIComponent(action)}`, { method: "POST" });
  if (!response.ok) throw new Error("El Centro no confirmó la acción por LoRa");
  notify(action === "accept" ? "Misión aceptada por el Centro" : "Estado confirmado por el Centro");
  await tick();
}

async function tick() {
  if (polling) return;
  polling = true;
  try {
    const response = await fetch("/api/state", { cache: "no-store" });
    if (!response.ok) throw new Error("estado no disponible");
    currentState = await response.json();
    renderState(currentState);
    const consumed = portalLogic.consumeState(cursor, currentState);
    cursor = consumed.cursor;
    alertQueue.push(...consumed.alerts);
    showNextAlert();
    elements.connectionDot.classList.add("ok");
    elements.connectionText.textContent = "Conectado al nodo local";
  } catch (_error) {
    elements.connectionDot.classList.remove("ok");
    elements.connectionText.textContent = "Reconectando con el nodo…";
  } finally {
    polling = false;
  }
}

elements.enableAlerts.addEventListener("click", enableAudio);
elements.enableCallAudio.addEventListener("click", enableAudio);
elements.silenceCall.addEventListener("click", closeAlert);
elements.acceptCall.addEventListener("click", async () => {
  try {
    await act("accept");
    closeAlert();
  } catch (error) {
    notify(error.message);
  }
});
document.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", async () => {
  try { await act(button.dataset.action); } catch (error) { notify(error.message); }
}));

tick();
setInterval(tick, 2500);
