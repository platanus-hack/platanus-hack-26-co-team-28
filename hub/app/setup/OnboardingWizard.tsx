"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { ClaudeLogo } from "@/components/logos/claude";
import { OpenAILogo } from "@/components/logos/openai";
import type { OnboardingGuide, OnboardingStepId } from "@/lib/onboarding";
import { copyPromptThenMaybeOpen } from "@/lib/prompt-actions";

import styles from "./setup.module.css";

type ProviderState = "idle" | "loading" | "success" | "fallback" | "error";
type CopyState = "idle" | "copying" | "success" | "error";
type PromptLoadState = "loading" | "ready" | "error";
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
  return (
    <span className={`${styles.aiLogo} ${provider === "claude" ? styles.claudeLogo : styles.chatGptLogo}`} aria-hidden="true">
      {provider === "claude" ? <ClaudeLogo /> : <OpenAILogo mode="dark" />}
    </span>
  );
}

function copyWithTemporarySelection(text: string) {
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.inset = "0 auto auto -9999px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, text.length);
  const copied = document.execCommand("copy");
  textarea.remove();
  previousFocus?.focus({ preventScroll: true });
  return copied;
}

async function writePromptToClipboard(text: string) {
  if (copyWithTemporarySelection(text)) return;
  if (!navigator.clipboard?.writeText) throw new Error("clipboard-unavailable");
  await navigator.clipboard.writeText(text);
}

function AiPromptMenu({
  className = "",
  intro,
  label,
  promptFile,
}: {
  className?: string;
  intro: string;
  label: string;
  promptFile: string;
}) {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [copyTarget, setCopyTarget] = useState<AiProvider | null>(null);
  const [promptLoadState, setPromptLoadState] = useState<PromptLoadState>("loading");
  const [promptText, setPromptText] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setPromptLoadState("loading");
    setPromptText(null);
    fetch(promptFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("prompt-unavailable");
        return response.text();
      })
      .then((text) => {
        setPromptText(text);
        setPromptLoadState("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setPromptLoadState("error");
      });
    return () => controller.abort();
  }, [promptFile]);

  async function copyPrompt(provider: AiProvider, openAfterCopy = false) {
    const destination = AI_DESTINATIONS[provider];
    setCopyTarget(provider);
    if (!promptText) {
      setCopyState("error");
      return;
    }
    setCopyState("copying");
    try {
      await copyPromptThenMaybeOpen({
        destinationUrl: destination.url,
        openAfterCopy,
        prompt: promptText,
        dependencies: {
          writeText: writePromptToClipboard,
          openDestination: (url) => {
            window.open(url, "_blank", "noopener,noreferrer");
          },
        },
      });
      setCopyState("success");
    } catch {
      setCopyState("error");
    }
  }

  return (
    <details className={`${styles.aiPrompt} ${className}`}>
      <summary className={styles.promptTrigger}>
        <CopyIcon />
        {copyState === "success" ? "Prompt copiado" : copyState === "error" ? "No se pudo copiar" : label}
        <span aria-hidden="true">⌄</span>
      </summary>
      <div className={styles.promptMenu}>
        <div className={styles.promptIntro}>
          <strong>Continúa con tu IA</strong>
          <span>{intro}</span>
          <a href={promptFile} target="_blank" rel="noreferrer">Ver archivo .md ↗</a>
          {promptLoadState === "error" && <em>No pudimos cargar el archivo. Ábrelo directamente.</em>}
        </div>
        {(Object.keys(AI_DESTINATIONS) as AiProvider[]).map((provider) => {
          const destination = AI_DESTINATIONS[provider];
          const activeCopy = copyTarget === provider;
          const disabled = promptLoadState !== "ready" || copyState === "copying";
          return (
            <div className={styles.aiOption} key={provider}>
              <AiIcon provider={provider} />
              <strong>{destination.label}</strong>
              <div className={styles.aiActions}>
                <button disabled={disabled} type="button" onClick={() => void copyPrompt(provider)}>
                  {promptLoadState === "loading" ? "Preparando…" : activeCopy && copyState === "copying" ? "Copiando…" : activeCopy && copyState === "success" ? "Copiado" : activeCopy && copyState === "error" ? "Reintentar" : "Copiar"}
                </button>
                <button disabled={disabled} type="button" onClick={() => void copyPrompt(provider, true)}>Copiar y abrir ↗</button>
              </div>
            </div>
          );
        })}
        <span className={styles.srOnly} aria-live="polite">{copyState === "error" ? "No se pudo copiar el prompt." : copyState === "success" ? `Prompt copiado para ${copyTarget ? AI_DESTINATIONS[copyTarget].label : "IA"}.` : ""}</span>
      </div>
    </details>
  );
}

export function OnboardingWizard({ guide }: { guide: OnboardingGuide }) {
  const [simulation, setSimulation] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [completed, setCompleted] = useState<OnboardingStepId[]>([]);
  const [voiceState, setVoiceState] = useState<ProviderState>("idle");
  const [voiceMessage, setVoiceMessage] = useState("");
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
                <div className={styles.pageHeadActions}>
                  <AiPromptMenu
                    className={styles.headerPrompt}
                    intro="Contexto completo para configurar WOKI, con o sin experiencia técnica."
                    label="Copiar prompt"
                    promptFile="/onboarding/WOKI-SETUP-PROMPT.md"
                  />
                  <span className="badge">{activeIndex + 1} / {guide.steps.length}</span>
                </div>
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
                    {step.resources?.map((resource) => (
                      <a className={styles.resourceLink} href={resource.href} key={resource.href} target="_blank" rel="noreferrer">{resource.label} ↗</a>
                    ))}
                  </div>

                  {step.assistantPrompt && (
                    <AiPromptMenu
                      className={styles.purchasePrompt}
                      intro={step.assistantPrompt.intro}
                      label={step.assistantPrompt.label}
                      promptFile={step.assistantPrompt.file}
                    />
                  )}

                  {step.command && (
                    <details className={styles.technical}>
                      <summary>Modo técnico</summary>
                      <pre><code>{step.command}</code></pre>
                      {step.documentation && <a href={step.documentation} target="_blank" rel="noreferrer">{step.documentationLabel ?? "Abrir documentación"} ↗</a>}
                    </details>
                  )}

                  <div className={styles.actions}>
                    <button className={styles.primaryButton} type="button" onClick={runPrimaryAction}>
                      {isCompleted ? "Continuar" : step.action}
                    </button>
                    <button className={styles.previousButton} type="button" disabled={activeIndex === 0} onClick={() => goToStep(activeIndex - 1)}>Anterior</button>
                  </div>
                </div>
              </section>

              {step.embed && (
                <section className={styles.embedSection} aria-labelledby="embed-title">
                  <div className={styles.embedHead}>
                    <div><p className="eyebrow">Explora y descarga</p><h3 id="embed-title">Archivos listos para impresión 3D</h3></div>
                    <a href={step.embed.src} target="_blank" rel="noreferrer">woki-lora-enclosures.vercel.app ↗</a>
                  </div>
                  <iframe loading="lazy" src={step.embed.src} title={step.embed.title} />
                </section>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
