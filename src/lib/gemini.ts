const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const model = "gemini-2.5-flash-lite";

export const NEXUS_SYSTEM_PROMPT =
  "Eres Nexus IA, asistente especializado en clima laboral, bienestar organizacional y liderazgo. Analizas datos de equipos y das recomendaciones a líderes sobre motivación, burnout, estrés y comunicación. Eres profesional, empático y directo.";

export function buildContextualPrompt(profile?: {
  emotional_intelligence_score?: number;
  collaboration_index?: number;
  stress_resilience?: number;
  empathy_score?: number;
  leadership_style?: string;
  conflict_mode?: string;
} | null, teamStats?: {
  climaPromedio?: number;
  totalComentarios?: number;
  totalPerfiles?: number;
} | null): string {
  let prompt = NEXUS_SYSTEM_PROMPT;

  if (profile) {
    prompt += `

PERFIL DEL USUARIO ACTUAL:
- Inteligencia Emocional: ${profile.emotional_intelligence_score ?? "N/A"}/100
- Índice de Colaboración: ${profile.collaboration_index ?? "N/A"}/100
- Resiliencia al Estrés: ${profile.stress_resilience ?? "N/A"}/100
- Empatía: ${profile.empathy_score ?? "N/A"}/100
- Estilo de Liderazgo: ${profile.leadership_style ?? "N/A"}
- Modo de Manejo de Conflictos: ${profile.conflict_mode ?? "N/A"}

Usa estos datos para personalizar TODAS tus respuestas. 
Cuando el usuario pregunte sobre su liderazgo, estrés o equipo, 
refiere específicamente a sus scores.`;
  }

  if (teamStats) {
    prompt += `

DATOS DEL EQUIPO HOY:
- Clima promedio: ${teamStats.climaPromedio ?? "N/A"}/5
- Comentarios anónimos activos: ${teamStats.totalComentarios ?? 0}
- Miembros con gemelo digital: ${teamStats.totalPerfiles ?? 0}

Analiza estos datos cuando el usuario pregunte por el estado del equipo.`;
  }

  return prompt;
}
export type GeminiHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

type GeminiContent = {
  role: "user" | "model";
  parts: { text: string }[];
};

type GenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: {
    message?: string;
    status?: string;
  };
};

function getApiKey(): string {
  if (!apiKey) {
    throw new Error(
      "Falta VITE_GEMINI_API_KEY en el archivo .env. Reinicia el servidor tras agregarla.",
    );
  }
  return apiKey;
}

function toGeminiContents(
  history: GeminiHistoryMessage[],
  userMessage: string,
  systemPrompt?: string,
): GeminiContent[] {
  const contents: GeminiContent[] = [];
  
  if (systemPrompt) {
    contents.push({ role: "user", parts: [{ text: systemPrompt }] });
    contents.push({ role: "model", parts: [{ text: "Entendido." }] });
  }
  
  history.forEach((message) => {
    contents.push({
      role: message.role === "user" ? "user" : "model",
      parts: [{ text: message.content }],
    });
  });

  contents.push({ role: "user", parts: [{ text: userMessage }] });
  return contents;
}

export async function generateNexusReply(
  history: GeminiHistoryMessage[],
  userMessage: string,
  customSystemPrompt?: string,
): Promise<string> {
  if (typeof window === "undefined") {
    throw new Error("El chat solo está disponible en el navegador.");
  }

  const key = getApiKey();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
    contents: toGeminiContents(history, userMessage, customSystemPrompt ?? NEXUS_SYSTEM_PROMPT),
    }),
  });

  let data: GenerateContentResponse;
  try {
    data = (await response.json()) as GenerateContentResponse;
  } catch {
    throw new Error(`Error HTTP ${response.status} al llamar a Gemini.`);
  }

  if (!response.ok) {
    const message =
      data.error?.message ?? `Error HTTP ${response.status} al llamar a Gemini.`;
    throw new Error(message);
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

  if (!text) {
    throw new Error("Gemini devolvió una respuesta vacía.");
  }

  return text;
}

export async function generateContent(
  history: GeminiHistoryMessage[] | Array<{ role: "user" | "assistant"; content: string }>,
  customSystemPrompt?: string,
): Promise<string> {
  if (!history.length) {
    throw new Error("No hay contenido para generar la respuesta.");
  }

  const lastMessage = history[history.length - 1];
  const previousMessages = history.slice(0, -1);

  return generateNexusReply(
    previousMessages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    lastMessage.content,
    customSystemPrompt,
  );
}
