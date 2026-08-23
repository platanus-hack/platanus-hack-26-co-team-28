import { getOnboardingStep, type OnboardingStepId } from "./onboarding";

export function buildSpanishNarration(stepId: OnboardingStepId) {
  const step = getOnboardingStep(stepId);
  return `${step.title}. ${step.instruction} ${step.facts.join(". ")}`;
}

export function buildAssistantPrompt(stepId: OnboardingStepId) {
  const step = getOnboardingStep(stepId);
  return {
    instructions: [
      "Eres el asistente de instalación de WOKI para una persona no técnica.",
      "Responde siempre en español claro y en máximo 45 palabras.",
      "Usa únicamente el contexto entregado; no inventes puertos, comandos ni capacidades.",
      "Da solo el siguiente movimiento útil y cómo reconocer que salió bien.",
      "Cierra con el nombre del archivo fuente.",
    ].join(" "),
    context: [
      `Paso: ${step.title}`,
      `Instrucción: ${step.instruction}`,
      `Hechos: ${step.facts.join("; ")}`,
      step.command ? `Comando equivalente: ${step.command}` : "",
      step.documentation ? `Fuente: ${step.documentation}` : "",
    ].filter(Boolean).join("\n"),
  };
}
