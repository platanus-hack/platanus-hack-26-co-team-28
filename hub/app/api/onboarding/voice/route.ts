import { NextResponse } from "next/server";

import { buildSpanishNarration } from "@/lib/onboarding-ai";
import { resourceOnboarding, type OnboardingStepId } from "@/lib/onboarding";

const STEP_IDS = new Set(resourceOnboarding().steps.map((step) => step.id));

function isStepId(value: string | null): value is OnboardingStepId {
  return value !== null && STEP_IDS.has(value as OnboardingStepId);
}

export async function GET(request: Request) {
  const stepId = new URL(request.url).searchParams.get("step");
  if (!isStepId(stepId)) {
    return NextResponse.json({ ok: false, error: "Paso desconocido" }, { status: 400 });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (!apiKey || !voiceId) {
    return NextResponse.json({ ok: false, error: "ElevenLabs aún no está configurado en el servidor" }, { status: 503 });
  }

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text: buildSpanishNarration(stepId),
        model_id: "eleven_multilingual_v2",
      }),
    },
  );

  if (!response.ok) {
    return NextResponse.json({ ok: false, error: "ElevenLabs no pudo generar la guía de voz" }, { status: 502 });
  }

  return new Response(response.body, {
    headers: {
      "Content-Type": response.headers.get("content-type") ?? "audio/mpeg",
      "Cache-Control": "public, s-maxage=604800, stale-while-revalidate=86400",
      "X-WOKI-Voice": "elevenlabs-es",
    },
  });
}
