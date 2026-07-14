import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Server-only structured (JSON) calls to Cerebras for the decision simulator.
// Unlike chat.functions.ts these are not streamed — the caller needs the
// whole structured object at once to render alternatives/outcomes.

const CEREBRAS_MODEL = "gemma-4-31b";

function extractJson(text: string): unknown {
  const stripped = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "");
  return JSON.parse(stripped);
}

async function callCerebrasJson(systemPrompt: string, userPrompt: string): Promise<unknown> {
  const apiKey = process.env.CEREBRAS_API_KEY;
  if (!apiKey) throw new Error("Falta CEREBRAS_API_KEY en el servidor.");

  const response = await fetch("https://api.cerebras.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: CEREBRAS_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_completion_tokens: 900,
      temperature: 0.6,
      top_p: 1,
      stream: false,
    }),
  });

  if (!response.ok) {
    let message = `Error HTTP ${response.status}`;
    try {
      const err = await response.json();
      message = err?.message ?? message;
    } catch {
      // body wasn't JSON — keep the HTTP status message
    }
    throw new Error(message);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Cerebras devolvió una respuesta vacía.");

  try {
    return extractJson(text);
  } catch {
    throw new Error("Nexus IA no devolvió un JSON válido para la simulación.");
  }
}

const generateAlternativesInput = z.object({
  decision: z.string().min(1),
  context: z.string().optional(),
});

export const generateAlternatives = createServerFn({ method: "POST" })
  .inputValidator(generateAlternativesInput)
  .handler(async ({ data }) => {
    const systemPrompt = `Eres Nexus IA, asistente de liderazgo organizacional. Un líder te describe una decisión que está evaluando.
Propón 2 o 3 alternativas de acción concretas y distintas entre sí (no triviales, con matices reales).
Responde EXCLUSIVAMENTE con JSON válido, sin texto adicional ni markdown, con esta forma exacta:
{"alternatives":[{"id":"a1","title":"...","description":"..."}]}
La descripción de cada alternativa debe tener máximo 2 líneas.`;

    const userPrompt = `Decisión a evaluar: ${data.decision}${data.context ? `\n\nContexto del equipo: ${data.context}` : ""}`;

    const parsed = await callCerebrasJson(systemPrompt, userPrompt);
    return parsed as { alternatives: Array<{ id: string; title: string; description: string }> };
  });

const simulateOutcomeInput = z.object({
  decision: z.string().min(1),
  chosenAlternative: z.object({ title: z.string(), description: z.string() }),
  context: z.string().optional(),
});

export const simulateOutcome = createServerFn({ method: "POST" })
  .inputValidator(simulateOutcomeInput)
  .handler(async ({ data }) => {
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
Alternativa elegida: ${data.chosenAlternative.title} — ${data.chosenAlternative.description}${data.context ? `\n\nContexto del equipo: ${data.context}` : ""}`;

    const parsed = await callCerebrasJson(systemPrompt, userPrompt);
    return parsed as {
      summary: string;
      risk_level: "low" | "medium" | "high" | "critical";
      risk_score: number;
      recommendations: string[];
      projected_metrics: Record<string, { before: number; after: number }>;
    };
  });
