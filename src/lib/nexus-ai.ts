import { sendChatMessage } from "./api/chat.functions";

export const NEXUS_SYSTEM_PROMPT = `Eres Nexus IA, asistente
especializado en clima laboral, bienestar organizacional y liderazgo.
Analizas datos de equipos y das recomendaciones a líderes sobre
motivación, burnout, estrés y comunicación.
Eres profesional, empático y directo. Respondes siempre en español.`;

export type ChatHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

async function streamChatCompletion(
  response: Response,
  onToken?: (partial: string) => void,
): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Cerebras no devolvió un stream válido.");

  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;

      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") continue;

      try {
        const parsed = JSON.parse(payload);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          full += delta;
          onToken?.(full);
        }
      } catch {
        // ignore malformed/partial SSE chunks
      }
    }
  }

  if (!full) throw new Error("Cerebras devolvió respuesta vacía.");
  return full;
}

export async function generateNexusReply(
  history: ChatHistoryMessage[],
  userMessage: string,
  customSystemPrompt?: string,
  onToken?: (partial: string) => void,
): Promise<string> {
  const response = await sendChatMessage({
    data: {
      history,
      userMessage,
      systemPrompt: customSystemPrompt ?? NEXUS_SYSTEM_PROMPT,
    },
  });

  return streamChatCompletion(response, onToken);
}

export async function generateContent(
  history: ChatHistoryMessage[],
  customSystemPrompt?: string,
): Promise<string> {
  if (!history.length) {
    throw new Error("No hay contenido para generar la respuesta.");
  }

  const lastMessage = history[history.length - 1];
  const previousMessages = history.slice(0, -1);

  return generateNexusReply(previousMessages, lastMessage.content, customSystemPrompt);
}

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
