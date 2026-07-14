import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Server-only call to Cerebras. The API key is read from process.env
// (no VITE_ prefix) so it never reaches the client bundle. Streams the
// upstream SSE response straight through to the caller.

// Model availability is account-specific — verified against this project's
// key via GET /v1/models. gemma-4-31b answers directly (no hidden reasoning
// phase like zai-glm-4.7/gpt-oss-120b on this account), so content starts
// streaming immediately instead of after a multi-second silent "thinking" gap.
const CEREBRAS_MODEL = "gemma-4-31b";

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const sendChatMessageInput = z.object({
  history: z.array(chatMessageSchema),
  userMessage: z.string().min(1),
  systemPrompt: z.string().optional(),
});

export const sendChatMessage = createServerFn({ method: "POST" })
  .inputValidator(sendChatMessageInput)
  .handler(async ({ data }) => {
    const apiKey = process.env.CEREBRAS_API_KEY;
    if (!apiKey) throw new Error("Falta CEREBRAS_API_KEY en el servidor.");

    const messages = [
      { role: "system", content: data.systemPrompt ?? "" },
      ...data.history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: data.userMessage },
    ];

    const response = await fetch("https://api.cerebras.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: CEREBRAS_MODEL,
        messages,
        max_completion_tokens: 1024,
        temperature: 0.7,
        top_p: 1,
        stream: true,
      }),
    });

    if (!response.ok || !response.body) {
      let message = `Error HTTP ${response.status}`;
      try {
        const err = await response.json();
        message = err?.message ?? message;
      } catch {
        // body wasn't JSON (e.g. upstream 5xx with an HTML page) — keep the HTTP status message
      }
      throw new Error(message);
    }

    return new Response(response.body, {
      headers: { "Content-Type": "text/event-stream" },
    });
  });
