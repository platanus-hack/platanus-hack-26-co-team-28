import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { NextResponse } from "next/server";

import { buildAssistantPrompt } from "@/lib/onboarding-ai";
import { resourceOnboarding, type OnboardingStepId } from "@/lib/onboarding";

const STEP_IDS = new Set(resourceOnboarding().steps.map((step) => step.id));

function isStepId(value: unknown): value is OnboardingStepId {
  return typeof value === "string" && STEP_IDS.has(value as OnboardingStepId);
}

export async function GET(request: Request) {
  const stepId = new URL(request.url).searchParams.get("step");
  if (!isStepId(stepId)) {
    return NextResponse.json({ ok: false, error: "Paso desconocido" }, { status: 400 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ ok: false, error: "Anthropic aún no está configurado en el servidor" }, { status: 503 });
  }

  const prompt = buildAssistantPrompt(stepId);
  try {
    const { text } = await generateText({
      model: anthropic(process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5"),
      instructions: prompt.instructions,
      prompt: `Explica este paso usando el siguiente contexto:\n\n${prompt.context}`,
      maxOutputTokens: 180,
      providerOptions: { anthropic: { effort: "low" } },
    });
    return NextResponse.json(
      { ok: true, answer: text, provider: "Anthropic" },
      { headers: { "Cache-Control": "public, s-maxage=604800, stale-while-revalidate=86400" } },
    );
  } catch {
    return NextResponse.json({ ok: false, error: "Anthropic no pudo responder en este momento" }, { status: 502 });
  }
}
