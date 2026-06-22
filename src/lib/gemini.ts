const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const model = "gemini-2.0-flash";

export const NEXUS_SYSTEM_PROMPT =
  "Eres Nexus IA, asistente especializado en clima laboral, bienestar organizacional y liderazgo. Analizas datos de equipos y das recomendaciones a líderes sobre motivación, burnout, estrés y comunicación. Eres profesional, empático y directo.";

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
): GeminiContent[] {
  const contents: GeminiContent[] = history.map((message) => ({
    role: message.role === "user" ? "user" : "model",
    parts: [{ text: message.content }],
  }));

  contents.push({
    role: "user",
    parts: [{ text: userMessage }],
  });

  return contents;
}

export async function generateNexusReply(
  history: GeminiHistoryMessage[],
  userMessage: string,
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
      "x-goog-api-key": key,
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: NEXUS_SYSTEM_PROMPT }],
      },
      contents: toGeminiContents(history, userMessage),
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
