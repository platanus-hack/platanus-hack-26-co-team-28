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
  const progress = finished ? 100 : Math.round(((activeIndex + 1) / guide.steps.length) * 100);

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
      setSerialMessage("Este navegador no ofrece Web Serial. Puedes continuar con el comando técnico.");
      return;
    }

    setSerialState("connecting");
    setSerialMessage("Selecciona la placa TTGO en la ventana del navegador.");
    try {
      const port = await browser.serial.requestPort();
      setSerialState("connected");
      setSerialMessage(`${portLabel(port)} · placa detectada, todavía sin escribir firmware.`);
    } catch (cause) {
      const cancelled = cause instanceof DOMException && cause.name === "NotFoundError";
      setSerialState("error");
      setSerialMessage(cancelled ? "No seleccionaste una placa. Puedes intentarlo nuevamente." : "No pudimos abrir el selector USB. Revisa el cable y vuelve a intentar.");
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
    setVoiceMessage("Preparando narración en español…");
    try {
      const response = await fetch(`/api/onboarding/voice?step=${encodeURIComponent(step.id)}`);
      if (!response.ok) throw new Error("provider-unavailable");
      const audioUrl = URL.createObjectURL(await response.blob());
      const audio = new Audio(audioUrl);
      audio.addEventListener("ended", () => URL.revokeObjectURL(audioUrl), { once: true });
      await audio.play();
      setVoiceState("success");
      setVoiceMessage("Narración generada por ElevenLabs · Español.");
    } catch {
      speakLocally();
      setVoiceState("fallback");
      setVoiceMessage("ElevenLabs no está configurado; usamos la voz en español del dispositivo.");
    }
  }

  async function askAnthropic() {
    setAssistantState("loading");
    setAssistantReply("Consultando la documentación de este paso…");
    try {
      const response = await fetch(`/api/onboarding/assist?step=${encodeURIComponent(step.id)}`);
      const body = await response.json() as { ok?: boolean; answer?: string; error?: string };
      if (!response.ok || !body.answer) throw new Error(body.error ?? "provider-unavailable");
      setAssistantState("success");
      setAssistantReply(body.answer);
    } catch {
      setAssistantState("error");
      setAssistantReply("Anthropic aún no está configurado. La guía determinística y los enlaces del repositorio siguen disponibles.");
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

  if (finished) {
    return (
      <main className={styles.finishShell}>
        <section className={styles.finishCard} aria-labelledby="finish-title">
          <span className={styles.finishMark} aria-hidden="true">✓</span>
          <p className={styles.kicker}>{simulation ? "Simulación completada" : "Verificación confirmada por el operador"}</p>
          <h1 id="finish-title">{simulation ? "Ya conoces el recorrido" : "Nodo de recurso listo"}</h1>
          <p>{simulation ? "Recorriste la instalación completa sin modificar dispositivos. Cambia a modo real cuando tengas el kit conectado." : "GRUA07 puede recibir una misión por LoRa y devolver su aceptación al Centro local."}</p>
          <div className={styles.finishActions}>
            <Link className={styles.primaryLink} href="/">Volver al Hub</Link>
            <button className={styles.secondaryButton} type="button" onClick={restart}>Preparar otro nodo</button>
          </div>
          <p className={styles.honestyNote}>{simulation ? "Ninguna placa fue detectada, configurada ni flasheada durante esta simulación." : "Esta confirmación registra tu prueba guiada; el inventario remoto automático se incorporará cuando el firmware soporte provisionamiento persistente."}</p>
        </section>
      </main>
    );
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="Volver a WOKI Hub">
          <span className={styles.brandMark} aria-hidden="true">W</span>
          <span>WOKI</span>
        </Link>
        <div className={styles.headerMeta}>
          <div className={styles.modeControl}>
            <span>Simular setup <small>(sin dispositivos)</small></span>
            <button
              className={styles.switch}
              type="button"
              role="switch"
              aria-checked={simulation}
              aria-label="Simular setup sin dispositivos"
              onClick={() => changeMode(!simulation)}
            ><span /></button>
          </div>
          <strong>{simulation ? "Demo" : `${guide.estimatedMinutes} min`}</strong>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.intro} aria-labelledby="setup-title">
          <div>
            <p className={styles.kicker}>Instalación · Nodo de recurso</p>
            <h1 id="setup-title">{guide.title}</h1>
            <p>{guide.promise}</p>
          </div>
          <div className={styles.progressLabel} aria-live="polite">
            <span>Paso {activeIndex + 1} de {guide.steps.length}</span>
            <strong>{progress}%</strong>
          </div>
        </section>

        <div className={styles.progressTrack} aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>

        <div className={`${styles.modeBanner} ${simulation ? styles.simulationBanner : styles.realBanner}`} role="status">
          <strong>{simulation ? "Simulación activa" : "Setup real"}</strong>
          <span>{simulation ? "Puedes abrir cualquier paso. No detectaremos ni modificaremos hardware." : "Cada paso se desbloquea después de su confirmación física."}</span>
        </div>

        <nav className={styles.stepper} aria-label="Pasos del onboarding">
          {guide.steps.map((item, index) => {
            const available = simulation || index <= activeIndex || completed.includes(item.id);
            return (
              <button
                className={index === activeIndex ? styles.activeStep : completed.includes(item.id) ? styles.doneStep : ""}
                disabled={!available}
                key={item.id}
                onClick={() => goToStep(index)}
                type="button"
                aria-current={index === activeIndex ? "step" : undefined}
              >
                <span>{completed.includes(item.id) ? "✓" : index + 1}</span>
                <small>{item.title}</small>
              </button>
            );
          })}
        </nav>

        <section className={styles.stepCard} aria-labelledby="step-title">
          <div className={styles.visual}>
            <Image
              src={step.image}
              width={step.imageWidth}
              height={step.imageHeight}
              sizes="(max-width: 820px) 100vw, 58vw"
              priority={activeIndex === 0}
              alt={step.imageAlt}
            />
            <span className={styles.visualBadge}>{step.blocking ? "Requerido" : "Preparación"}</span>
          </div>

          <div className={styles.instructions}>
            <div>
              <p className={styles.kicker}>{step.eyebrow}</p>
              <h2 id="step-title">{step.title}</h2>
              <p className={styles.lead}>{step.instruction}</p>
            </div>

            <ul className={styles.factList}>
              {step.facts.map((fact) => <li key={fact}>{fact}</li>)}
            </ul>

            {step.id === "usb" && serialMessage && (
              <div className={`${styles.deviceState} ${styles[serialState]}`} role="status">
                <span aria-hidden="true" />
                {serialMessage}
              </div>
            )}

            <div className={styles.actions}>
              <button className={styles.primaryButton} disabled={serialState === "connecting"} type="button" onClick={runPrimaryAction}>
                {simulation ? `Simular: ${step.action}` : step.id === "usb" && serialState === "connected" ? "Continuar con esta placa" : serialState === "connecting" ? "Esperando selección…" : isCompleted ? "Continuar" : step.action}
              </button>
            </div>

            <section className={styles.aiTools} aria-label="Asistencia inteligente">
              <article className={styles.aiTool}>
                <div className={styles.aiToolHead}>
                  <span className={styles.providerMark} aria-hidden="true">11</span>
                  <div><strong>ElevenLabs</strong><small>Guía de voz · Español</small></div>
                  <span className={styles.onlineBadge}>Online opcional</span>
                </div>
                <p>Escucha esta instrucción con una voz natural. Si el servicio no está configurado, usamos la voz española del dispositivo.</p>
                <button className={styles.providerButton} disabled={voiceState === "loading"} type="button" onClick={() => void playVoice()}>
                  {voiceState === "loading" ? "Generando audio…" : "▶ Escuchar en español"}
                </button>
                {voiceMessage && <small className={styles.providerMessage} role="status">{voiceMessage}</small>}
              </article>

              <article className={styles.aiTool}>
                <div className={styles.aiToolHead}>
                  <span className={`${styles.providerMark} ${styles.anthropicMark}`} aria-hidden="true">A</span>
                  <div><strong>Anthropic</strong><small>Ayuda contextual · Repositorio</small></div>
                  <span className={styles.onlineBadge}>Online opcional</span>
                </div>
                <p>Explica por qué importa este paso y cómo saber si salió bien, usando únicamente la documentación WOKI.</p>
                <button className={styles.providerButton} disabled={assistantState === "loading"} type="button" onClick={() => void askAnthropic()}>
                  {assistantState === "loading" ? "Consultando…" : "Explicar este paso"}
                </button>
                {assistantReply && <div className={`${styles.assistantReply} ${assistantState === "error" ? styles.providerError : ""}`} role="status">{assistantReply}</div>}
              </article>
            </section>

            {step.id === "usb" && (serialState === "unsupported" || serialState === "error") && (
              <button className={styles.textButton} type="button" onClick={completeAndAdvance}>Continuar con verificación manual</button>
            )}

            {(step.command || step.documentation) && (
              <details className={styles.technical}>
                <summary>Opciones técnicas y documentación</summary>
                {step.command && <pre><code>{step.command}</code></pre>}
                {step.documentation && (
                  <a href={step.documentation} target="_blank" rel="noreferrer">{step.documentationLabel ?? "Abrir documentación"} <span aria-hidden="true">↗</span></a>
                )}
              </details>
            )}

            <div className={styles.navigation}>
              <button type="button" disabled={activeIndex === 0} onClick={() => goToStep(activeIndex - 1)}>← Paso anterior</button>
              <span>{simulation ? "La simulación no modifica dispositivos." : "Las acciones críticas requieren tu confirmación."}</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
