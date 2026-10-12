import process from "node:process";

// Server-only Cerebras client shared by the chat and simulation server fns.
// The API key is read from process.env (no VITE_ prefix) inside the function
// so it never reaches the client bundle and binds per request.

// Model availability is account-specific — verified against this project's
// key via GET /v1/models. gemma-4-31b answers directly (no hidden reasoning
// phase like zai-glm-4.7/gpt-oss-120b on this account), so content starts
// streaming immediately instead of after a multi-second silent "thinking" gap.
export const CEREBRAS_MODEL = "gemma-4-31b";

export type CerebrasMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type CerebrasOptions = {
  messages: CerebrasMessage[];
  maxTokens: number;
  temperature: number;
  stream: boolean;
};

// Returns the raw upstream response once it is known to be OK; throws a
// readable error otherwise.
export async function callCerebras({
  messages,
  maxTokens,
  temperature,
  stream,
}: CerebrasOptions): Promise<Response> {
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
      messages,
      max_completion_tokens: maxTokens,
      temperature,
      top_p: 1,
      stream,
    }),
  });

  if (!response.ok || (stream && !response.body)) {
    let message = `Error HTTP ${response.status}`;
    try {
      const err = await response.json();
      message = err?.message ?? message;
    } catch {
      // body wasn't JSON (e.g. upstream 5xx with an HTML page) — keep the HTTP status message
    }
    throw new Error(message);
  }

  return response;
}
