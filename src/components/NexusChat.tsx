import { Send, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useNexusChat } from "@/hooks/useNexusChat";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

type NexusChatProps = {
  className?: string;
};

function getInitials(name?: string | null, email?: string | null) {
  if (name) {
    const parts = name.split(" ").filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return "LD";
}

function timeAgo(dateStr?: string) {
  if (!dateStr) return "hace un momento";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "hace un momento";
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `hace ${days}d`;
}

function parseMarkdown(text: string) {
  // simple, safe-ish parser for **bold**, lists (- item) and paragraphs
  const escapeHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const paragraphs = text.split(/\n\n+/);
  const html = paragraphs
    .map((p) => {
      const trimmed = p.trim();
      if (trimmed.startsWith("- ")) {
        const items = trimmed.split(/\n/).map((l) => escapeHtml(l.replace(/^- /, "")).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>"));
        return `<ul>${items.map((it) => `<li>${it}</li>`).join("")}</ul>`;
      }
      const replaced = escapeHtml(trimmed).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      return `<p>${replaced}</p>`;
    })
    .join("");

  return html;
}

export function NexusChat({ className }: NexusChatProps) {
  const { messages, input, setInput, isTyping, error, sendMessage, handleSubmit, sessions, activeSessionId, loadSession, newSession } = useNexusChat();
  const [initials, setInitials] = useState<string>("LD");
  const lastMsgRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // scroll last message into view smoothly
    lastMsgRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isTyping]);

  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setInitials(getInitials(user?.user_metadata?.full_name ?? null, user?.email ?? null));
    })();
  }, []);

  return (
    <div className={cn("relative z-10 flex-1 overflow-hidden rounded-2xl bg-brand-navy shadow-lg shadow-brand-navy/20", className)} style={{ minHeight: 'calc(100dvh - 8rem)' }}>
      <div className="lg:grid lg:grid-cols-[260px_1fr] lg:gap-6 lg:min-h-[calc(100vh-13rem)]">
        {/* Sidebar - desktop only */}
        <aside className="hidden lg:flex lg:flex-col lg:w-[260px] lg:rounded-xl lg:border lg:border-white/6 lg:bg-white/3 lg:p-3">
          <div className="flex items-center justify-between px-2 py-2">
            <button onClick={() => void newSession()} className="rounded-md bg-white/5 px-3 py-2 text-sm font-semibold text-white">＋ Nueva conversación</button>
          </div>
          <div className="mt-2 flow-root overflow-auto">
            <ul className="-my-2 divide-y divide-white/6">
              {sessions.slice(0,20).map((s) => (
                <li key={s.id} className="py-2">
                  <button onClick={() => void loadSession(s.id)} className={cn("w-full text-left px-3 py-2 rounded-md", s.id === activeSessionId ? 'border border-blue-400 bg-white/5' : 'hover:bg-white/3')}>
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">{(s.title || 'Nueva conversación').slice(0,40)}</p>
                        <p className="mt-1 text-xs text-white/60">{timeAgo(s.updated_at)}</p>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Main chat panel */}
        <div className="flex flex-col rounded-2xl border border-white/10 bg-brand-navy lg:rounded-none lg:border-0">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-purple/25 text-brand-purple font-semibold">{initials}</div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-white">Nexus IA</p>
                <p className="text-[11px] text-brand-blue">Asistente de clima laboral · Nexus IA</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className={"rounded-full px-2.5 py-1 text-[10px] font-semibold " + (isTyping ? "bg-brand-purple/20 text-brand-purple" : "bg-brand-emerald/15 text-brand-emerald")}>{isTyping ? "Escribiendo…" : "En línea"}</span>
              {/* Mobile new session button */}
              <button onClick={() => void newSession()} className="lg:hidden rounded-md bg-white/5 px-3 py-1 text-sm font-semibold text-white">＋ Nueva</button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5">
            <div className="space-y-4">
              {messages.map((msg, idx) => (
                <div key={msg.id} className={msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'} ref={idx === messages.length - 1 ? lastMsgRef : undefined}>
                  {msg.role === 'assistant' && (
                    <div className="mr-3 mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-purple/20 text-brand-purple font-semibold">{initials}</div>
                  )}
                  <div className={cn("max-w-[85%] rounded-2xl text-base lg:text-sm leading-relaxed", msg.role === 'user' ? 'rounded-br-md bg-brand-blue text-brand-navy px-5 py-4' : 'rounded-tl-md border border-white/10 bg-white/5 text-white/90 px-5 py-4') }>
                    {msg.role === 'assistant' ? (
                      <div dangerouslySetInnerHTML={{ __html: parseMarkdown(msg.content) }} />
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex items-start gap-2">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-purple/20 text-brand-purple"> <Sparkles className="size-3.5" /> </div>
                  <div className="rounded-2xl rounded-tl-md border border-white/10 bg-white/5 px-5 py-4">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-brand-blue [animation-delay:0ms]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-brand-purple [animation-delay:150ms]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-brand-blue [animation-delay:300ms]" />
                      <span className="ml-2 text-xs text-brand-blue">Escribiendo…</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Composer */}
          <div className="border-t border-white/10 bg-brand-navy/80 p-4 pb-6 lg:pb-4">
            {error && (
              <p className="mb-3 rounded-lg border border-brand-red/30 bg-brand-red/10 px-3 py-2 text-xs text-brand-red">{error}</p>
            )}
            <form onSubmit={handleSubmit} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 focus-within:border-brand-blue focus-within:ring-2 focus-within:ring-brand-blue/20">
              <input value={input} onChange={(e) => setInput(e.target.value)} disabled={isTyping} placeholder="Pregunta a Nexus IA sobre tu equipo…" className="min-w-0 bg-transparent text-base lg:text-sm text-white outline-none placeholder:text-white/40 disabled:opacity-60" style={{ minHeight: 48 }} />
              <button type="submit" disabled={isTyping || !input.trim()} aria-label="Enviar mensaje" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-blue to-brand-purple text-brand-navy transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
                <Send className="size-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
