import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireUser } from "./auth.middleware";
import { callCerebras } from "./cerebras.server";
import { buildContextualPrompt } from "./nexus-context.server";

// Authenticated chat call to Cerebras. The system prompt is built on the
// server from the user's own profile + org indicators; the client only sends
// the conversation. Streams the upstream SSE response straight through.

const MAX_HISTORY_MESSAGES = 20;

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(8000),
});

const sendChatMessageInput = z.object({
  history: z.array(chatMessageSchema).max(200),
  userMessage: z.string().trim().min(1).max(4000),
});

export const sendChatMessage = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(sendChatMessageInput)
  .handler(async ({ data, context }) => {
    const systemPrompt = await buildContextualPrompt(context.supabase, context.user.id);

    const response = await callCerebras({
      messages: [
        { role: "system", content: systemPrompt },
        ...data.history.slice(-MAX_HISTORY_MESSAGES),
        { role: "user", content: data.userMessage },
      ],
      maxTokens: 1024,
      temperature: 0.7,
      stream: true,
    });

    return new Response(response.body, {
      headers: { "Content-Type": "text/event-stream" },
    });
  });
