import { useCallback, useRef, useState } from "react";

import { generateNexusReply, type GeminiHistoryMessage } from "@/lib/gemini";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Hola. Soy Nexus IA. Puedo ayudarte a interpretar el clima laboral, detectar señales de estrés o burnout y sugerir acciones para tu equipo. ¿En qué te gustaría profundizar?",
};

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function toHistory(messages: ChatMessage[]): GeminiHistoryMessage[] {
  return messages
    .filter((message) => message.id !== "welcome")
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));
}

export function useNexusChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isTypingRef = useRef(false);
  const messagesRef = useRef(messages);

  messagesRef.current = messages;

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isTypingRef.current) return;

    const userMessage: ChatMessage = {
      id: createId(),
      role: "user",
      content: trimmed,
    };

    const history = toHistory(messagesRef.current);

    isTypingRef.current = true;
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setError(null);
    setIsTyping(true);

    try {
      const response = await generateNexusReply(history, trimmed);

      setMessages((prev) => [
        ...prev,
        { id: createId(), role: "assistant", content: response },
      ]);
    } catch (err) {
      console.error("Error en Nexus IA:", err);
      setError(
        err instanceof Error
          ? err.message
          : "No pude procesar tu mensaje. Verifica la API key de Gemini e inténtalo de nuevo.",
      );
    } finally {
      isTypingRef.current = false;
      setIsTyping(false);
    }
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      void sendMessage(input);
    },
    [input, sendMessage],
  );

  return {
    messages,
    input,
    setInput,
    isTyping,
    error,
    sendMessage,
    handleSubmit,
  };
}
