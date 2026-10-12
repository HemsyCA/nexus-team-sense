import { sendChatMessage } from "./api/chat.functions";

// Client-side wrapper over the sendChatMessage server fn. The system prompt
// (persona + user profile + org indicators) is built on the server.

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
  onToken?: (partial: string) => void,
): Promise<string> {
  const response = await sendChatMessage({
    data: { history, userMessage },
  });

  return streamChatCompletion(response, onToken);
}

export async function generateContent(history: ChatHistoryMessage[]): Promise<string> {
  if (!history.length) {
    throw new Error("No hay contenido para generar la respuesta.");
  }

  const lastMessage = history[history.length - 1];
  const previousMessages = history.slice(0, -1);

  return generateNexusReply(previousMessages, lastMessage.content);
}
