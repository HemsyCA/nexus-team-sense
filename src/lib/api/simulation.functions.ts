import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireUser } from "./auth.middleware";
import { callCerebras } from "./cerebras.server";
import { describeProfile, getUserProfile } from "./nexus-context.server";

// Authenticated structured (JSON) calls to Cerebras for the decision simulator.
// Unlike chat.functions.ts these are not streamed — the caller needs the
// whole structured object at once to render alternatives/outcomes. Model
// output is validated with zod so a malformed answer fails cleanly instead
// of breaking the UI.

function extractJson(text: string): unknown {
  const stripped = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "");
  return JSON.parse(stripped);
}

async function callCerebrasJson<T>(
  systemPrompt: string,
  userPrompt: string,
  schema: z.ZodType<T>,
): Promise<T> {
  const response = await callCerebras({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    maxTokens: 900,
    temperature: 0.6,
    stream: false,
  });

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Cerebras devolvió una respuesta vacía.");

  let parsed: unknown;
  try {
    parsed = extractJson(text);
  } catch {
    throw new Error("Nexus IA no devolvió un JSON válido para la simulación.");
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new Error("Nexus IA devolvió una simulación con un formato inesperado. Inténtalo de nuevo.");
  }
  return result.data;
}

async function getLeaderContext(client: SupabaseClient, userId: string) {
  const profile = await getUserProfile(client, userId);
  return profile ? `\n\nPerfil del líder:\n${describeProfile(profile)}` : "";
}

const alternativesSchema = z.object({
  alternatives: z
    .array(z.object({ id: z.string(), title: z.string(), description: z.string() }))
    .min(1),
});

const generateAlternativesInput = z.object({
  decision: z.string().trim().min(1).max(2000),
});

export const generateAlternatives = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(generateAlternativesInput)
  .handler(async ({ data, context }) => {
    const systemPrompt = `Eres Nexus IA, asistente de liderazgo organizacional. Un líder te describe una decisión que está evaluando.
Propón 2 o 3 alternativas de acción concretas y distintas entre sí (no triviales, con matices reales).
Responde EXCLUSIVAMENTE con JSON válido, sin texto adicional ni markdown, con esta forma exacta:
{"alternatives":[{"id":"a1","title":"...","description":"..."}]}
La descripción de cada alternativa debe tener máximo 2 líneas.`;

    const userPrompt = `Decisión a evaluar: ${data.decision}${await getLeaderContext(context.supabase, context.user.id)}`;

    return callCerebrasJson(systemPrompt, userPrompt, alternativesSchema);
  });

const metricSchema = z.object({
  before: z.coerce.number().min(0).max(100),
  after: z.coerce.number().min(0).max(100),
});

const outcomeSchema = z.object({
  summary: z.string(),
  risk_level: z.enum(["low", "medium", "high", "critical"]),
  risk_score: z.coerce.number().min(0).max(10),
  recommendations: z.array(z.string()),
  projected_metrics: z.record(metricSchema),
});

const simulateOutcomeInput = z.object({
  decision: z.string().trim().min(1).max(2000),
  chosenAlternative: z.object({
    title: z.string().max(300),
    description: z.string().max(1000),
  }),
});

export const simulateOutcome = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(simulateOutcomeInput)
  .handler(async ({ data, context }) => {
    const systemPrompt = `Eres Nexus IA, asistente de liderazgo organizacional. Un líder eligió una alternativa concreta para una decisión que estaba evaluando.
Simula el resultado probable de esa elección para su equipo.
Responde EXCLUSIVAMENTE con JSON válido, sin texto adicional ni markdown, con esta forma exacta:
{
  "summary": "resumen de 2-3 líneas del resultado probable",
  "risk_level": "low" | "medium" | "high" | "critical",
  "risk_score": number entre 0 y 10,
  "recommendations": ["recomendación breve", "..."],
  "projected_metrics": {
    "estres": {"before": number 0-100, "after": number 0-100},
    "motivacion": {"before": number 0-100, "after": number 0-100},
    "clima": {"before": number 0-100, "after": number 0-100},
    "productividad": {"before": number 0-100, "after": number 0-100},
    "confianza": {"before": number 0-100, "after": number 0-100}
  }
}
"before" son valores estimados de la situación actual del equipo; "after" es la proyección tras aplicar la alternativa elegida.`;

    const userPrompt = `Decisión original: ${data.decision}
Alternativa elegida: ${data.chosenAlternative.title} — ${data.chosenAlternative.description}${await getLeaderContext(context.supabase, context.user.id)}`;

    return callCerebrasJson(systemPrompt, userPrompt, outcomeSchema);
  });
