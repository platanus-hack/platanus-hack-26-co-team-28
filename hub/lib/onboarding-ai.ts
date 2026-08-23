import { getOnboardingStep, type OnboardingStepId } from "./onboarding";

export function buildSpanishNarration(stepId: OnboardingStepId) {
  const step = getOnboardingStep(stepId);
  return `${step.title}. ${step.instruction} ${step.facts.join(". ")}`;
}
