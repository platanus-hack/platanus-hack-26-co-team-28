"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import type { OnboardingGuide, OnboardingStepId } from "@/lib/onboarding";

import styles from "./setup.module.css";

type ProviderState = "idle" | "loading" | "success" | "fallback" | "error";
type CopyState = "idle" | "copying" | "success" | "error";
type AiProvider = "chatgpt" | "claude";

const AI_DESTINATIONS = {
  chatgpt: { label: "ChatGPT", url: "https://chatgpt.com/" },
  claude: { label: "Claude", url: "https://claude.ai/new" },
} satisfies Record<AiProvider, { label: string; url: string }>;

function SpeakerIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M11 5 6.5 9H3v6h3.5l4.5 4V5Z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <rect x="8" y="8" width="11" height="11" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </svg>
  );
}

function AiIcon({ provider }: { provider: AiProvider }) {
  if (provider === "claude") {
    return (
      <span className={`${styles.aiLogo} ${styles.claudeLogo}`} aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4M8.5 3.8l7 16.4M20.2 8.5l-16.4 7" /></svg>
      </span>
    );
  }
  return (
    <span className={`${styles.aiLogo} ${styles.chatGptLogo}`} aria-hidden="true">
      <svg viewBox="0 0 24 24"><path d="M12 4.1a4 4 0 0 1 6.8 2.8 4 4 0 0 1 .8 7.4 4 4 0 0 1-5.9 5.4 4 4 0 0 1-7-2.4 4 4 0 0 1-.9-7.4A4 4 0 0 1 12 4.1Z" /><path d="m8.2 9.8 3.8-2.2 3.8 2.2v4.4L12 16.4l-3.8-2.2V9.8Z" /></svg>
    </span>
  );
}

export function OnboardingWizard({ guide }: { guide: OnboardingGuide }) {
  const [simulation, setSimulation] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [completed, setCompleted] = useState<OnboardingStepId[]>([]);
  const [voiceState, setVoiceState] = useState<ProviderState>("idle");
  const [voiceMessage, setVoiceMessage] = useState("");
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [copyTarget, setCopyTarget] = useState<AiProvider | null>(null);
  const [finished, setFinished] = useState(false);
  const step = guide.steps[activeIndex];
  const isCompleted = completed.includes(step.id);
  const progress = Math.round(((activeIndex + 1) / guide.steps.length) * 100);

  function resetGuides() {
    setVoiceState("idle");
    setVoiceMessage("");
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

  function runPrimaryAction() {
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

  async function copySetupPrompt(provider: AiProvider, openAfterCopy = false) {
    const destination = AI_DESTINATIONS[provider];
    const openedWindow = openAfterCopy ? window.open("about:blank", "_blank") : null;
    if (openedWindow) openedWindow.opener = null;
    setCopyTarget(provider);
    setCopyState("copying");
    try {
      const response = await fetch("/onboarding/WOKI-SETUP-PROMPT.md");
      if (!response.ok) throw new Error("prompt-unavailable");
      const prompt = await response.text();
      await navigator.clipboard.writeText(prompt);
      setCopyState("success");
      if (openAfterCopy) {
        if (openedWindow) openedWindow.location.href = destination.url;
        else window.open(destination.url, "_blank", "noopener,noreferrer");
      }
    } catch {
      setCopyState("error");
      if (openedWindow) openedWindow.location.href = destination.url;
    }
  }

  function changeMode(enabled: boolean) {
    setSimulation(enabled);
    setActiveIndex(0);
    setCompleted([]);
    setFinished(false);
    resetGuides();
  }

  function restart() {
    setActiveIndex(0);
    setCompleted([]);
    setFinished(false);
    resetGuides();
  }

  return (
    <div className={styles.setupShell}>
      <a className="skip-link" href="#setup-content">Ir al contenido</a>

      <div className={styles.setupWorkspace}>
        <header className="topbar">
          <div><p className="eyebrow">Configuración</p><h1>Preparar kit</h1></div>
          <div className={styles.topbarActions}>
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
                <Link className={styles.primaryLink} href="/command-center">Entrar al Centro</Link>
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

                  <div className={styles.helpRow}>
                    {step.documentation && <a href={step.documentation} target="_blank" rel="noreferrer">Ver fuente ↗</a>}
                  </div>

                  {step.command && (
                    <details className={styles.technical}>
                      <summary>Modo técnico</summary>
                      <pre><code>{step.command}</code></pre>
                      {step.documentation && <a href={step.documentation} target="_blank" rel="noreferrer">{step.documentationLabel ?? "Abrir documentación"} ↗</a>}
                    </details>
                  )}

                  <details className={styles.aiPrompt}>
                    <summary className={styles.promptTrigger}>
                      <CopyIcon />
                      {copyState === "success" ? `Prompt copiado para ${copyTarget ? AI_DESTINATIONS[copyTarget].label : "IA"}` : "Copiar prompt para una IA"}
                      <span aria-hidden="true">⌄</span>
                    </summary>
                    <div className={styles.promptMenu}>
                      <div className={styles.promptIntro}><strong>Continúa con tu IA</strong><span>El prompt incluye los 7 pasos, comandos y documentación.</span></div>
                      {(Object.keys(AI_DESTINATIONS) as AiProvider[]).map((provider) => {
                        const destination = AI_DESTINATIONS[provider];
                        const activeCopy = copyTarget === provider;
                        return (
                          <div className={styles.aiOption} key={provider}>
                            <AiIcon provider={provider} />
                            <strong>{destination.label}</strong>
                            <div className={styles.aiActions}>
                              <button disabled={copyState === "copying"} type="button" onClick={() => void copySetupPrompt(provider)}>
                                {activeCopy && copyState === "copying" ? "Copiando…" : activeCopy && copyState === "success" ? "Copiado" : "Copiar"}
                              </button>
                              <button disabled={copyState === "copying"} type="button" onClick={() => void copySetupPrompt(provider, true)}>Copiar y abrir ↗</button>
                            </div>
                          </div>
                        );
                      })}
                      <span className={styles.srOnly} aria-live="polite">{copyState === "error" ? "No se pudo copiar el prompt." : copyState === "success" ? "Prompt copiado." : ""}</span>
                    </div>
                  </details>

                  <div className={styles.actions}>
                    <button className={styles.primaryButton} type="button" onClick={runPrimaryAction}>
                      {isCompleted ? "Continuar" : step.action}
                    </button>
                    <button className={styles.previousButton} type="button" disabled={activeIndex === 0} onClick={() => goToStep(activeIndex - 1)}>Anterior</button>
                  </div>
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
