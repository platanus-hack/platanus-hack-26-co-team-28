"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import type { OnboardingGuide, OnboardingStepId } from "@/lib/onboarding";

import styles from "./setup.module.css";

type SerialState = "idle" | "connecting" | "connected" | "unsupported" | "error";
type ProviderState = "idle" | "loading" | "success" | "fallback" | "error";

type SerialPortLike = {
  getInfo?: () => { usbVendorId?: number; usbProductId?: number };
};

type SerialNavigator = Navigator & {
  serial?: { requestPort: () => Promise<SerialPortLike> };
};

function portLabel(port: SerialPortLike) {
  const info = port.getInfo?.();
  if (!info?.usbVendorId) return "Puerto USB autorizado";
  const vendor = info.usbVendorId.toString(16).toUpperCase().padStart(4, "0");
  const product = info.usbProductId?.toString(16).toUpperCase().padStart(4, "0");
  return product ? `USB ${vendor}:${product}` : `USB ${vendor}`;
}

function CommandCenterSidebar() {
  return (
    <aside className="sidebar">
      <Link className="brand" href="/" aria-label="Volver al Centro LoRa">
        <span className="brand-mark" aria-hidden="true" />
        <span className="brand-label">Centro LoRa</span>
      </Link>

      <nav aria-label="Navegación principal">
        <Link href="/"><span className="nav-icon" aria-hidden="true">◉</span><span className="nav-label">Overview</span></Link>
        <span className="nav-disabled" aria-disabled="true"><span className="nav-icon" aria-hidden="true">!</span><span className="nav-label">Solicitudes</span></span>
        <Link href="/setup" aria-current="page"><span className="nav-icon" aria-hidden="true">＋</span><span className="nav-label">Preparar kit</span></Link>
        <span className="nav-disabled" aria-disabled="true"><span className="nav-icon" aria-hidden="true">R</span><span className="nav-label">Recursos</span></span>
        <span className="nav-disabled" aria-disabled="true"><span className="nav-icon" aria-hidden="true">≋</span><span className="nav-label">Red LoRa</span></span>
      </nav>

      <div className="sidebar-footer">
        <span className="status-dot connected" aria-hidden="true" />
        <span>Configuración guiada</span>
      </div>
    </aside>
  );
}

function SpeakerIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M11 5 6.5 9H3v6h3.5l4.5 4V5Z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" />
    </svg>
  );
}

export function OnboardingWizard({ guide }: { guide: OnboardingGuide }) {
  const [simulation, setSimulation] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [completed, setCompleted] = useState<OnboardingStepId[]>([]);
  const [serialState, setSerialState] = useState<SerialState>("idle");
  const [serialMessage, setSerialMessage] = useState("");
  const [voiceState, setVoiceState] = useState<ProviderState>("idle");
  const [voiceMessage, setVoiceMessage] = useState("");
  const [assistantState, setAssistantState] = useState<ProviderState>("idle");
  const [assistantReply, setAssistantReply] = useState("");
  const [finished, setFinished] = useState(false);
  const step = guide.steps[activeIndex];
  const isCompleted = completed.includes(step.id);
  const progress = Math.round(((activeIndex + 1) / guide.steps.length) * 100);

  function resetGuides() {
    setVoiceState("idle");
    setVoiceMessage("");
    setAssistantState("idle");
    setAssistantReply("");
  }

  function goToStep(index: number) {
    resetGuides();
    setActiveIndex(index);
  }

  function completeAndAdvance() {
    setCompleted((current) => current.includes(step.id) ? current : [...current, step.id]);
    if (activeIndex === guide.steps.length - 1) {
      setFinished(true);
      return;
    }
    resetGuides();
    setActiveIndex((current) => current + 1);
  }

  async function detectBoard() {
    const browser = navigator as SerialNavigator;
    if (!window.isSecureContext || !browser.serial) {
      setSerialState("unsupported");
      setSerialMessage("Web Serial no está disponible. Usa el modo técnico.");
      return;
    }

    setSerialState("connecting");
    setSerialMessage("Selecciona la placa TTGO.");
    try {
      const port = await browser.serial.requestPort();
      setSerialState("connected");
      setSerialMessage(`${portLabel(port)} · placa detectada.`);
    } catch (cause) {
      const cancelled = cause instanceof DOMException && cause.name === "NotFoundError";
      setSerialState("error");
      setSerialMessage(cancelled ? "No seleccionaste una placa." : "No se pudo abrir el puerto USB.");
    }
  }

  function runPrimaryAction() {
    if (simulation) {
      completeAndAdvance();
      return;
    }
    if (step.id === "usb" && serialState !== "connected") {
      void detectBoard();
      return;
    }
    completeAndAdvance();
  }

  function speakLocally() {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(`${step.title}. ${step.instruction} ${step.facts.join(". ")}`);
    speech.lang = "es-CO";
    speech.rate = 0.96;
    window.speechSynthesis.speak(speech);
  }

  async function playVoice() {
    setVoiceState("loading");
    setVoiceMessage("Preparando guía de voz.");
    try {
      const response = await fetch(`/api/onboarding/voice?step=${encodeURIComponent(step.id)}`);
      if (!response.ok) throw new Error("provider-unavailable");
      const audioUrl = URL.createObjectURL(await response.blob());
      const audio = new Audio(audioUrl);
      const release = () => URL.revokeObjectURL(audioUrl);
      audio.addEventListener("ended", release, { once: true });
      audio.addEventListener("error", release, { once: true });
      await audio.play();
      setVoiceState("success");
      setVoiceMessage("Reproduciendo guía en español.");
    } catch {
      speakLocally();
      setVoiceState("fallback");
      setVoiceMessage("Usando la voz del dispositivo.");
    }
  }

  async function askAnthropic() {
    setAssistantState("loading");
    setAssistantReply("");
    try {
      const response = await fetch(`/api/onboarding/assist?step=${encodeURIComponent(step.id)}`);
      const body = await response.json() as { answer?: string; error?: string };
      if (!response.ok || !body.answer) throw new Error(body.error ?? "provider-unavailable");
      setAssistantState("success");
      setAssistantReply(body.answer);
    } catch {
      setAssistantState("error");
      setAssistantReply("No se pudo cargar la ayuda. Consulta la fuente del repositorio.");
    }
  }

  function changeMode(enabled: boolean) {
    setSimulation(enabled);
    setActiveIndex(0);
    setCompleted([]);
    setSerialState("idle");
    setSerialMessage("");
    setFinished(false);
    resetGuides();
  }

  function restart() {
    setActiveIndex(0);
    setCompleted([]);
    setSerialState("idle");
    setSerialMessage("");
    setFinished(false);
    resetGuides();
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#setup-content">Ir al contenido</a>
      <CommandCenterSidebar />

      <div className="workspace">
        <header className="topbar">
          <div><p className="eyebrow">Configuración</p><h1>Preparar kit</h1></div>
          <div className="topbar-status">
            <span className={styles.modeLabel}>Simular sin dispositivos</span>
            <button
              className={styles.switch}
              type="button"
              role="switch"
              aria-checked={simulation}
              aria-label="Simular setup sin dispositivos"
              onClick={() => changeMode(!simulation)}
            ><span /></button>
            <span className={`badge ${simulation ? "action" : "success"}`}>{simulation ? "Simulación" : "Modo real"}</span>
          </div>
        </header>

        <main className={styles.main} id="setup-content">
          {finished ? (
            <section className={styles.finishPanel} aria-labelledby="finish-title">
              <span className={styles.finishMark} aria-hidden="true">✓</span>
              <p className="eyebrow">{simulation ? "Simulación completa" : "Verificación completa"}</p>
              <h2 id="finish-title">{simulation ? "Recorrido listo" : "GRUA07 listo"}</h2>
              <p>{simulation ? "No se modificó ningún dispositivo." : "El nodo recibe misiones y confirma por LoRa."}</p>
              <div className={styles.finishActions}>
                <Link className={styles.primaryLink} href="/">Volver al Centro</Link>
                <button className={styles.secondaryButton} type="button" onClick={restart}>Repetir</button>
              </div>
            </section>
          ) : (
            <>
              <section className={styles.pageHead} aria-labelledby="setup-title">
                <div><h2 id="setup-title">{guide.title}</h2><p>{guide.promise}</p></div>
                <span className="badge">{activeIndex + 1} / {guide.steps.length}</span>
              </section>

              <div className={styles.progressTrack} aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>

              <div className={styles.stepper} role="tablist" aria-label="Pasos del onboarding">
                {guide.steps.map((item, index) => {
                  const available = simulation || index <= activeIndex || completed.includes(item.id);
                  return (
                    <button
                      className={index === activeIndex ? styles.activeStep : completed.includes(item.id) ? styles.doneStep : ""}
                      disabled={!available}
                      key={item.id}
                      onClick={() => goToStep(index)}
                      role="tab"
                      type="button"
                      aria-selected={index === activeIndex}
                    >
                      <span>{completed.includes(item.id) ? "✓" : index + 1}</span>
                      <small>{item.title}</small>
                    </button>
                  );
                })}
              </div>

              <section className={styles.stepPanel} aria-labelledby="step-title">
                <div className={styles.visual}>
                  <Image src={step.image} width={step.imageWidth} height={step.imageHeight} sizes="(max-width: 900px) 100vw, 54vw" priority={activeIndex === 0} alt={step.imageAlt} />
                </div>

                <div className={styles.instructions}>
                  <div className={styles.titleRow}>
                    <div><p className="eyebrow">{step.eyebrow}</p><h2 id="step-title">{step.title}</h2></div>
                    <button
                      className={`${styles.voiceButton} ${voiceState === "loading" ? styles.voiceLoading : ""}`}
                      disabled={voiceState === "loading"}
                      type="button"
                      onClick={() => void playVoice()}
                      aria-label="Escuchar guía por voz en español"
                      title="Escuchar guía por voz"
                    ><SpeakerIcon /></button>
                    <span className={styles.srOnly} aria-live="polite">{voiceMessage}</span>
                  </div>

                  <p className={styles.lead}>{step.instruction}</p>
                  <ul className={styles.factList}>{step.facts.map((fact) => <li key={fact}>{fact}</li>)}</ul>

                  {step.id === "usb" && serialMessage && (
                    <div className={`${styles.deviceState} ${styles[serialState]}`} role="status"><span aria-hidden="true" />{serialMessage}</div>
                  )}

                  <div className={styles.helpRow}>
                    <button disabled={assistantState === "loading"} type="button" onClick={() => void askAnthropic()} title="Ayuda de Anthropic basada en la documentación WOKI">
                      {assistantState === "loading" ? "Consultando…" : "✦ Ayuda contextual"}
                    </button>
                    {step.documentation && <a href={step.documentation} target="_blank" rel="noreferrer">Ver fuente ↗</a>}
                  </div>

                  {assistantReply && (
                    <div className={`${styles.assistantReply} ${assistantState === "error" ? styles.providerError : ""}`} role="status">{assistantReply}</div>
                  )}

                  {step.command && (
                    <details className={styles.technical}>
                      <summary>Modo técnico</summary>
                      <pre><code>{step.command}</code></pre>
                      {step.documentation && <a href={step.documentation} target="_blank" rel="noreferrer">{step.documentationLabel ?? "Abrir documentación"} ↗</a>}
                    </details>
                  )}

                  <div className={styles.actions}>
                    <button className={styles.primaryButton} disabled={serialState === "connecting"} type="button" onClick={runPrimaryAction}>
                      {step.id === "usb" && !simulation && serialState === "connected" ? "Continuar" : serialState === "connecting" ? "Esperando placa…" : isCompleted ? "Continuar" : step.action}
                    </button>
                    <button className={styles.previousButton} type="button" disabled={activeIndex === 0} onClick={() => goToStep(activeIndex - 1)}>Anterior</button>
                  </div>

                  {step.id === "usb" && !simulation && (serialState === "unsupported" || serialState === "error") && (
                    <button className={styles.manualButton} type="button" onClick={completeAndAdvance}>Verificación manual</button>
                  )}
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
