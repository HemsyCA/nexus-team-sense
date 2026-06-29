import { useCallback, useEffect, useRef, useState } from "react";

import { generateNexusReply, buildContextualPrompt, type GeminiHistoryMessage } from "@/lib/gemini";
import { supabase } from "@/lib/supabase";

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
  const [systemPrompt, setSystemPrompt] = useState<string>("");
  const isTypingRef = useRef(false);
  const messagesRef = useRef(messages);

  messagesRef.current = messages;

  // Carga el perfil del usuario y datos del equipo al montar
  useEffect(() => {
    async function loadContext() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // Perfil del gemelo digital
        const { data: profile } = await supabase
          .from("digital_twin_profiles")
          .select("*")
          .eq("user_id", session.user.id)
          .maybeSingle();

        // Datos del equipo: clima promedio de hoy
        const today = new Date().toISOString().split("T")[0];
        const { data: pulseData } = await supabase
          .from("daily_pulse")
          .select("mood")
          .eq("pulse_date", today);

        const { count: totalComentarios } = await supabase
          .from("daily_feeds")
          .select("*", { count: "exact", head: true });

        const { count: totalPerfiles } = await supabase
          .from("digital_twin_profiles")
          .select("*", { count: "exact", head: true });

        // Calcula clima promedio
        let climaPromedio: number | undefined;
        if (pulseData && pulseData.length > 0) {
          const moodValues = { good: 5, neutral: 3, bad: 1 };
          const sum = pulseData.reduce((acc, p) => 
            acc + (moodValues[p.mood as keyof typeof moodValues] ?? 3), 0
          );
          climaPromedio = Math.round((sum / pulseData.length) * 10) / 10;
        }

        const prompt = buildContextualPrompt(
          profile,
          {
            climaPromedio,
            totalComentarios: totalComentarios ?? 0,
            totalPerfiles: totalPerfiles ?? 0,
          }
        );

        setSystemPrompt(prompt);

        // Actualiza el mensaje de bienvenida con el nombre si existe
        if (profile?.leadership_style) {
          setMessages([{
            id: "welcome",
            role: "assistant",
            content: `Hola. Soy Nexus IA. He cargado tu perfil de liderazgo — veo que tu estilo predominante es **${profile.leadership_style}** con un índice de colaboración de ${profile.collaboration_index}/100. ¿En qué aspecto de tu equipo quieres profundizar hoy?`,
          }]);
        }
      } catch (err) {
        console.error("Error cargando contexto:", err);
      }
    }

    void loadContext();
  }, []);

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
      // Usa el prompt contextual si está disponible
      const response = await generateNexusReply(
        history, 
        trimmed,
        systemPrompt || undefined
      );

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
  }, [systemPrompt]);

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