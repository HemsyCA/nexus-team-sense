import { useCallback, useEffect, useRef, useState } from "react";

import { generateNexusReply, buildContextualPrompt, type ChatHistoryMessage } from "@/lib/nexus-ai";
import { supabase } from "@/lib/supabase";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
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

function toHistory(messages: ChatMessage[]): ChatHistoryMessage[] {
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
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionTitle, setSessionTitle] = useState<string | null>(null);

  const isTypingRef = useRef(false);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  // Carga contexto, sesiones y mensajes al montar
  useEffect(() => {
    async function init() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // Perfil y datos del equipo para el system prompt
        const { data: profile } = await supabase
          .from("digital_twin_profiles")
          .select("*")
          .eq("user_id", session.user.id)
          .maybeSingle();

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

        // Load or create latest session
        const { data: recentSessions } = await supabase
          .from("chat_sessions")
          .select("*")
          .eq("user_id", session.user.id)
          .order("updated_at", { ascending: false })
          .limit(20);

        setSessions(recentSessions ?? []);

        let activeId: string | null = null;
        if (recentSessions && recentSessions.length > 0) {
          activeId = recentSessions[0].id;
        } else {
          const { data: newSession } = await supabase
            .from("chat_sessions")
            .insert([{ user_id: session.user.id, title: "Nueva conversación" }])
            .select()
            .maybeSingle();
          if (newSession) {
            activeId = newSession.id;
            setSessions((s) => [newSession, ...s]);
          }
        }

        if (activeId) {
          setActiveSessionId(activeId);
          // load messages for active session
          const { data: msgs } = await supabase
            .from("chat_messages")
            .select("*")
            .eq("session_id", activeId)
            .order("created_at", { ascending: true });

          if (msgs && msgs.length > 0) {
            const mapped = msgs.map((m: any) => ({ id: m.id, role: m.role, content: m.content, created_at: m.created_at } as ChatMessage));
            setMessages(mapped);
          } else {
            setMessages([WELCOME_MESSAGE]);
          }
        }

        // Personaliza welcome con perfil si aplica
        if (profile?.leadership_style) {
          setMessages([{
            id: "welcome",
            role: "assistant",
            content: `Hola. Soy Nexus IA. He cargado tu perfil de liderazgo — veo que tu estilo predominante es **${profile.leadership_style}** con un índice de colaboración de ${profile.collaboration_index}/100. ¿En qué aspecto de tu equipo quieres profundizar hoy?`,
          }]);
        }
      } catch (err) {
        console.error("Error inicializando chat:", err);
      }
    }

    void init();
  }, []);

  const refreshSessions = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase
      .from("chat_sessions")
      .select("*")
      .eq("user_id", session.user.id)
      .order("updated_at", { ascending: false })
      .limit(20);
    setSessions(data ?? []);
  }, []);

  const loadSession = useCallback(async (sessionId: string) => {
    try {
      const { data: msgs } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

      if (msgs && msgs.length > 0) {
        const mapped = msgs.map((m: any) => ({ id: m.id, role: m.role, content: m.content, created_at: m.created_at } as ChatMessage));
        setMessages(mapped);
      } else {
        setMessages([WELCOME_MESSAGE]);
      }
      setActiveSessionId(sessionId);
      const s = sessions.find((s) => s.id === sessionId);
      setSessionTitle(s?.title ?? null);
    } catch (err) {
      console.error("Error cargando sesión:", err);
    }
  }, [sessions]);

  const newSession = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data: newSession } = await supabase
      .from("chat_sessions")
      .insert([{ user_id: session.user.id, title: "Nueva conversación" }])
      .select()
      .maybeSingle();
    if (newSession) {
      setSessions((s) => [newSession, ...s].slice(0, 20));
      setActiveSessionId(newSession.id);
      setSessionTitle(newSession.title);
      setMessages([WELCOME_MESSAGE]);
    }
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isTypingRef.current) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !activeSessionId) return;

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
      // Insert user message into Supabase
      await supabase.from("chat_messages").insert([{ session_id: activeSessionId, user_id: session.user.id, role: "user", content: trimmed }]);

      // If session title is default, update with the first 40 chars of user's first message
      if (!sessionTitle || sessionTitle === "Nueva conversación") {
        const newTitle = trimmed.slice(0, 40);
        await supabase.from("chat_sessions").update({ title: newTitle, updated_at: new Date().toISOString() }).eq("id", activeSessionId);
        setSessionTitle(newTitle);
      } else {
        await supabase.from("chat_sessions").update({ updated_at: new Date().toISOString() }).eq("id", activeSessionId);
      }

      // Call model, streaming tokens into a placeholder assistant message
      const assistantId = createId();
      let started = false;
      const response = await generateNexusReply(
        history,
        trimmed,
        systemPrompt || undefined,
        (partial) => {
          if (!started) {
            started = true;
            setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: partial } as ChatMessage]);
          } else {
            setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: partial } : m)));
          }
        },
      );

      if (!started) {
        setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: response } as ChatMessage]);
      }

      // Insert assistant message into Supabase and refresh sessions
      await supabase.from("chat_messages").insert([{ session_id: activeSessionId, user_id: session.user.id, role: "assistant", content: response }]);
      await refreshSessions();
    } catch (err) {
      console.error("Error en Nexus IA:", err);
      setError(
        err instanceof Error
          ? err.message
          : "No pude procesar tu mensaje. Verifica la API key e inténtalo de nuevo.",
      );
    } finally {
      isTypingRef.current = false;
      setIsTyping(false);
    }
  }, [activeSessionId, systemPrompt, refreshSessions, sessionTitle]);

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
    sessions,
    activeSessionId,
    loadSession,
    newSession,
  };
}