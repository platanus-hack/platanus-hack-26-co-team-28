import type { Metadata } from "next";

import { resourceOnboarding } from "@/lib/onboarding";

import { OnboardingWizard } from "./OnboardingWizard";

export const metadata: Metadata = {
  title: "Preparar kit | WOKI",
  description: "Guía visual para instalar y verificar un nodo de recurso WOKI.",
};

export default function SetupPage() {
  return <OnboardingWizard guide={resourceOnboarding()} />;
}
