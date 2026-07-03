const apiKey = import.meta.env.VITE_CEREBRAS_API_KEY as string | undefined;
const model = "llama-4-scout-17b-16e-instruct";

export const NEXUS_SYSTEM_PROMPT = `Eres Nexus IA, asistente 
especializado en clima laboral, bienestar organizacional y liderazgo. 
Analizas datos de equipos y das recomendaciones a líderes sobre 
motivación, burnout, estrés y comunicación. 
Eres profesional, empático y directo. Respondes siempre en español.`;

export type GeminiHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function generateNexusReply(
  history: GeminiHistoryMessage[],
  userMessage: string,
  customSystemPrompt?: string,
): Promise<string> {
  if (!apiKey) throw new Error("Falta VITE_CEREBRAS_API_KEY en .env");

  const messages = [
    { role: "system", content: customSystemPrompt ?? NEXUS_SYSTEM_PROMPT },
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: "user", content: userMessage }
  ];

  const response = await fetch(
    "https://api.cerebras.ai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_completion_tokens: 1024,
        temperature: 0.7,
        top_p: 1,
        stream: false,
      }),
    }
  );

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err?.message ?? `Error HTTP ${response.status}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Cerebras devolvió respuesta vacía.");
  return text;
}

// Mantener buildContextualPrompt igual que antes para el contexto del perfil
export function buildContextualPrompt(profile?: any, teamStats?: any): string {
  let prompt = NEXUS_SYSTEM_PROMPT;
  if (profile) {
    prompt += `\n\nPERFIL DEL USUARIO:
- Inteligencia Emocional: ${profile.emotional_intelligence_score ?? 'N/A'}/100
- Colaboración: ${profile.collaboration_index ?? 'N/A'}/100
- Resiliencia al Estrés: ${profile.stress_resilience ?? 'N/A'}/100
- Empatía: ${profile.empathy_score ?? 'N/A'}/100
- Estilo de Liderazgo: ${profile.leadership_style ?? 'N/A'}
- Modo de Conflicto: ${profile.conflict_mode ?? 'N/A'}
Usa estos datos para personalizar todas tus respuestas.`;
  }
  if (teamStats) {
    prompt += `\n\nDATOS DEL EQUIPO HOY:
- Clima promedio: ${teamStats.climaPromedio ?? 'N/A'}/5
- Comentarios activos: ${teamStats.totalComentarios ?? 0}
- Miembros con gemelo digital: ${teamStats.totalPerfiles ?? 0}`;
  }
  return prompt;
}

export async function generateContent(
  history: GeminiHistoryMessage[] | Array<{ role: "user" | "assistant"; content: string }>,
  customSystemPrompt?: string,
): Promise<string> {
  if (!history.length) {
    throw new Error("No hay contenido para generar la respuesta.");
  }

  const lastMessage = history[history.length - 1];
  const previousMessages = history.slice(0, -1).map((m: any) => ({ role: m.role as "user" | "assistant", content: m.content }));

  return generateNexusReply(previousMessages, lastMessage.content, customSystemPrompt);
}
