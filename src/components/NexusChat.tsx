import { Send, Sparkles } from "lucide-react";
import { useEffect, useRef } from "react";

import { useNexusChat } from "@/hooks/useNexusChat";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "¿Cómo está el clima laboral esta semana?",
  "¿Qué factores están generando estrés?",
  "Dame una recomendación para mejorar la comunicación.",
  "Simula qué pasaría si cambio el horario de reuniones.",
];

type NexusChatProps = {
  className?: string;
};

export function NexusChat({ className }: NexusChatProps) {
  const { messages, input, setInput, isTyping, error, sendMessage, handleSubmit } =
    useNexusChat();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isTyping]);

  return (
    <div
      className={cn(
        "relative z-10 flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-brand-navy shadow-lg shadow-brand-navy/20",
        className ?? "h-[min(520px,70vh)]",
      )}
    >
      {/* Header */}
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-white/10 bg-brand-navy px-5 py-4">
        <div className="grid size-10 place-items-center rounded-xl bg-brand-purple/25 text-brand-purple">
          <Sparkles className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-white">Nexus IA</p>
          <p className="text-[11px] text-brand-blue">
            Asistente de clima laboral · Gemini 2.0 Flash
          </p>
        </div>
        <span
          className={
            "rounded-full px-2.5 py-1 text-[10px] font-semibold " +
            (isTyping
              ? "bg-brand-purple/20 text-brand-purple"
              : "bg-brand-emerald/15 text-brand-emerald")
          }
        >
          {isTyping ? "Escribiendo…" : "En línea"}
        </span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-5">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={
              msg.role === "user" ? "flex justify-end" : "flex justify-start"
            }
          >
            {msg.role === "assistant" && (
              <div className="mr-2 mt-1 grid size-7 shrink-0 place-items-center rounded-lg bg-brand-purple/20 text-brand-purple">
                <Sparkles className="size-3.5" />
              </div>
            )}
            <div
              className={
                "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed " +
                (msg.role === "user"
                  ? "rounded-br-md bg-brand-blue text-brand-navy"
                  : "rounded-tl-md border border-white/10 bg-white/5 text-white/90")
              }
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex items-start gap-2">
            <div className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand-purple/20 text-brand-purple">
              <Sparkles className="size-3.5" />
            </div>
            <div className="rounded-2xl rounded-tl-md border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex items-center gap-1.5">
                <span className="size-2 animate-bounce rounded-full bg-brand-blue [animation-delay:0ms]" />
                <span className="size-2 animate-bounce rounded-full bg-brand-purple [animation-delay:150ms]" />
                <span className="size-2 animate-bounce rounded-full bg-brand-blue [animation-delay:300ms]" />
                <span className="ml-2 text-xs text-brand-blue">Escribiendo…</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Suggestions */}
      <div className="flex flex-wrap gap-2 border-t border-white/10 px-5 py-3">
        {SUGGESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            disabled={isTyping}
            onClick={() => void sendMessage(q)}
            className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-white/80 transition hover:border-brand-blue hover:bg-brand-blue/10 hover:text-brand-blue disabled:cursor-not-allowed disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Composer — extra bottom padding on mobile so nav bar doesn't cover input */}
      <div className="border-t border-white/10 bg-brand-navy/80 p-4 pb-6 lg:pb-4">
        {error && (
          <p className="mb-3 rounded-lg border border-brand-red/30 bg-brand-red/10 px-3 py-2 text-xs text-brand-red">
            {error}
          </p>
        )}
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 focus-within:border-brand-blue focus-within:ring-2 focus-within:ring-brand-blue/20"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isTyping}
            placeholder="Pregunta a Nexus IA sobre tu equipo…"
            className="min-w-0 bg-transparent text-sm text-white outline-none placeholder:text-white/40 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={isTyping || !input.trim()}
            aria-label="Enviar mensaje"
            className="grid size-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-blue to-brand-purple text-brand-navy transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send className="size-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
