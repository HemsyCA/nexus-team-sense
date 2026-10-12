import { useCallback, useEffect, useRef, useState } from "react";

import { generateNexusReply, type ChatHistoryMessage } from "@/lib/nexus-ai";
import { supabase } from "@/lib/supabase";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
};

export type ChatSession = {
  id: string;
  title: string;
  updated_at: string | null;
};

type ChatMessageRow = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string | null;
};

function fromRows(rows: ChatMessageRow[]): ChatMessage[] {
  return rows.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    created_at: m.created_at ?? undefined,
  }));
}

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
  const [sessions, setSessions] = useState<ChatSession[]>([]);
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

        // Perfil para personalizar el saludo (el system prompt se arma en el servidor)
        const { data: profile } = await supabase
          .from("digital_twin_profiles")
          .select("leadership_style, collaboration_index")
          .eq("user_id", session.user.id)
          .maybeSingle();

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
            const mapped = fromRows(msgs as ChatMessageRow[]);
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
        const mapped = fromRows(msgs as ChatMessageRow[]);
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

  const newSession = useCallback(async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
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
      return newSession.id;
    }
    return null;
  }, []);

  const sendMessage = useCallback(async (text: string, sessionIdOverride?: string) => {
    const trimmed = text.trim();
    if (!trimmed || isTypingRef.current) return;

    const { data: { session } } = await supabase.auth.getSession();
    const targetSessionId = sessionIdOverride ?? activeSessionId;
    if (!session || !targetSessionId) return;

    const userMessage: ChatMessage = {
      id: createId(),
      role: "user",
      content: trimmed,
    };

    // Starting a fresh session (sessionIdOverride) never has prior context —
    // messagesRef could still hold the previous session's messages for a beat
    // since newSession()'s setMessages hasn't necessarily flushed yet.
    const history = sessionIdOverride ? [] : toHistory(messagesRef.current);

    isTypingRef.current = true;
    setMessages((prev) => (sessionIdOverride ? [userMessage] : [...prev, userMessage]));
    setInput("");
    setError(null);
    setIsTyping(true);

    try {
      // Insert user message into Supabase
      await supabase.from("chat_messages").insert([{ session_id: targetSessionId, user_id: session.user.id, role: "user", content: trimmed }]);

      // If session title is default, update with the first 40 chars of user's first message
      if (!sessionTitle || sessionTitle === "Nueva conversación" || sessionIdOverride) {
        const newTitle = trimmed.slice(0, 40);
        await supabase.from("chat_sessions").update({ title: newTitle, updated_at: new Date().toISOString() }).eq("id", targetSessionId);
        setSessionTitle(newTitle);
      } else {
        await supabase.from("chat_sessions").update({ updated_at: new Date().toISOString() }).eq("id", targetSessionId);
      }

      // Call model, streaming tokens into a placeholder assistant message
      const assistantId = createId();
      let started = false;
      const response = await generateNexusReply(
        history,
        trimmed,
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
      await supabase.from("chat_messages").insert([{ session_id: targetSessionId, user_id: session.user.id, role: "assistant", content: response }]);
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
  }, [activeSessionId, refreshSessions, sessionTitle]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      void sendMessage(input);
    },
    [input, sendMessage],
  );

  // Starts a brand-new session seeded with a coaching case as the first
  // message, instead of the user typing it in manually.
  const startCaseSession = useCallback(
    async (caseText: string) => {
      const newId = await newSession();
      if (!newId) return;
      await sendMessage(caseText, newId);
    },
    [newSession, sendMessage],
  );

  const generateCaseSuggestion = useCallback(async (): Promise<string> => {
    const instruction =
      "Propón UN caso de coaching de liderazgo realista y breve (máximo 3 líneas) para que un líder lo trabaje contigo. " +
      "Usa el contexto del perfil/equipo si está disponible. Devuelve SOLO el texto del caso, sin explicaciones ni encabezados.";
    return generateNexusReply([], instruction);
  }, []);

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
    startCaseSession,
    generateCaseSuggestion,
  };
}