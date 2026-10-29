import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowUp,
  Check,
  Copy,
  HeartPulse,
  History,
  MessageSquareText,
  Plus,
  Sparkles,
  Swords,
  TrendingDown,
  Wand2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { useNexusChat, type ChatMessage } from "@/hooks/useNexusChat";
import { cn } from "@/lib/utils";

type NexusChatProps = {
  className?: string;
};

const COACHING_CASES = [
  { icon: HeartPulse, title: "Señales de burnout", text: "Un miembro del equipo muestra señales de burnout" },
  { icon: MessageSquareText, title: "Feedback difícil", text: "Necesito dar feedback difícil a un top performer" },
  { icon: Swords, title: "Conflicto en el equipo", text: "Dos colaboradores están en conflicto por prioridades" },
  { icon: TrendingDown, title: "Equipo desmotivado", text: "Mi equipo está desmotivado tras un cambio organizacional" },
];

function timeAgo(dateStr?: string | null) {
  if (!dateStr) return "Ahora";
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return "Ahora";
  if (mins < 60) return `Hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs} h`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? "Ayer" : `Hace ${days} días`;
}

// Small, safe Markdown subset: headings, bullet/numbered lists, **bold**,
// *italic* and paragraphs. All text is HTML-escaped first.
function parseMarkdown(text: string) {
  const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s: string) =>
    escapeHtml(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");

  const html: string[] = [];
  let list: { type: "ul" | "ol"; items: string[] } | null = null;
  const flush = () => {
    if (list) html.push(`<${list.type}>${list.items.map((i) => `<li>${i}</li>`).join("")}</${list.type}>`);
    list = null;
  };

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    const numbered = line.match(/^\d+[.)]\s+(.*)$/);
    const heading = line.match(/^#{1,4}\s+(.*)$/);

    if (bullet || numbered) {
      const type = bullet ? "ul" : "ol";
      if (!list || list.type !== type) {
        flush();
        list = { type, items: [] };
      }
      list.items.push(inline((bullet ?? numbered)![1]));
    } else {
      flush();
      if (!line) continue;
      html.push(heading ? `<h4>${inline(heading[1])}</h4>` : `<p>${inline(line)}</p>`);
    }
  }
  flush();
  return html.join("");
}

function NexusAvatar({ size = "md", pulse = false }: { size?: "md" | "lg"; pulse?: boolean }) {
  return (
    <div
      className={cn(
        "relative grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-blue via-sky-500 to-brand-purple text-white shadow-md shadow-brand-purple/20",
        size === "lg" ? "size-14" : "size-8",
      )}
    >
      {pulse ? <span className="absolute inset-0 animate-ping rounded-full bg-brand-purple/30" /> : null}
      <Sparkles className={size === "lg" ? "size-6" : "size-4"} />
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] text-muted-foreground transition hover:bg-muted hover:text-foreground"
      aria-label="Copiar respuesta"
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? "Copiado" : "Copiar"}
    </button>
  );
}

function MessageRow({ message, isStreaming }: { message: ChatMessage; isStreaming: boolean }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end duration-300 animate-in fade-in slide-in-from-bottom-2">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-3xl rounded-br-lg bg-brand-navy px-5 py-3 text-[15px] leading-relaxed text-white shadow-sm">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="group flex gap-3 duration-300 animate-in fade-in slide-in-from-bottom-2">
      <NexusAvatar />
      <div className="min-w-0 flex-1 pt-0.5">
        <div
          className={cn(
            "nexus-markdown text-[15px] leading-relaxed text-foreground",
            "[&_h4]:mb-1 [&_h4]:mt-4 [&_h4]:font-semibold [&_li]:mb-1 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-3 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5",
            isStreaming && "[&>*:last-child]:after:ml-0.5 [&>*:last-child]:after:inline-block [&>*:last-child]:after:h-4 [&>*:last-child]:after:w-1.5 [&>*:last-child]:after:translate-y-0.5 [&>*:last-child]:after:animate-pulse [&>*:last-child]:after:rounded-sm [&>*:last-child]:after:bg-brand-purple [&>*:last-child]:after:content-['']",
          )}
          dangerouslySetInnerHTML={{ __html: parseMarkdown(message.content) }}
        />
        {!isStreaming && message.id !== "welcome" ? (
          <div className="mt-2 opacity-0 transition group-hover:opacity-100 max-lg:opacity-100">
            <CopyButton text={message.content} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function NexusChat({ className }: NexusChatProps) {
  const {
    messages,
    input,
    setInput,
    isTyping,
    error,
    sendMessage,
    sessions,
    activeSessionId,
    loadSession,
    newSession,
    startCaseSession,
    generateCaseSuggestion,
  } = useNexusChat();
  const [isGeneratingCase, setIsGeneratingCase] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const isEmpty = messages.length === 1 && messages[0].id === "welcome";
  const welcome = isEmpty ? messages[0] : null;
  const busy = isTyping || isGeneratingCase;
  const lastMessage = messages[messages.length - 1];
  // Once the reply starts streaming, the growing text is the "typing" signal;
  // the dots only cover the gap before the first token.
  const showTypingDots = isTyping && lastMessage?.role !== "assistant";

  async function handleGenerateCase() {
    if (busy) return;
    setIsGeneratingCase(true);
    try {
      const caseText = await generateCaseSuggestion();
      await startCaseSession(caseText);
    } catch (err) {
      console.error("Error generando caso de coaching:", err);
    } finally {
      setIsGeneratingCase(false);
    }
  }

  function submit() {
    if (!input.trim() || isTyping) return;
    void sendMessage(input);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  }

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (isEmpty) el.scrollTo({ top: 0 });
    else el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping, isEmpty]);

  // Auto-grow the composer up to ~6 lines.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, [input]);

  const historyList = (
    <>
      <button
        type="button"
        onClick={() => {
          void newSession();
          setShowHistory(false);
        }}
        className="flex w-full items-center gap-2 rounded-2xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition hover:border-brand-purple/40 hover:shadow-md"
      >
        <Plus className="size-4" />
        Nueva conversación
      </button>
      <p className="mb-2 mt-5 px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Recientes</p>
      <ul className="space-y-0.5 overflow-y-auto">
        {sessions.slice(0, 20).map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => {
                void loadSession(s.id);
                setShowHistory(false);
              }}
              className={cn(
                "w-full rounded-xl px-3 py-2 text-left transition",
                s.id === activeSessionId ? "bg-brand-purple/10 text-foreground" : "text-muted-foreground hover:bg-muted",
              )}
            >
              <p className="truncate text-sm font-medium">{s.title || "Nueva conversación"}</p>
              <p className="mt-0.5 text-[11px] opacity-70">{timeAgo(s.updated_at)}</p>
            </button>
          </li>
        ))}
      </ul>
    </>
  );

  return (
    <div
      className={cn(
        "relative flex h-[640px] overflow-hidden rounded-3xl border border-border bg-card shadow-sm max-lg:rounded-none max-lg:border-0",
        className,
      )}
    >
      {/* Historial (escritorio) */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-muted/30 p-3 lg:flex">{historyList}</aside>

      {/* Historial (móvil) */}
      {showHistory ? (
        <div className="absolute inset-0 z-30 flex lg:hidden">
          <div className="flex w-72 flex-col bg-card p-3 shadow-xl duration-200 animate-in slide-in-from-left">
            <div className="mb-3 flex items-center justify-between px-1">
              <span className="text-sm font-semibold">Conversaciones</span>
              <button type="button" onClick={() => setShowHistory(false)} aria-label="Cerrar historial" className="rounded-full p-1.5 hover:bg-muted">
                <X className="size-4" />
              </button>
            </div>
            {historyList}
          </div>
          <button type="button" aria-label="Cerrar historial" className="flex-1 bg-black/20" onClick={() => setShowHistory(false)} />
        </div>
      ) : null}

      <div className="relative flex min-w-0 flex-1 flex-col bg-gradient-to-b from-card to-brand-bg">
        {/* Encabezado */}
        <header className="flex items-center justify-between gap-3 border-b border-border/60 bg-card/80 px-4 py-3 backdrop-blur">
          <div className="flex min-w-0 items-center gap-2">
            <Link to="/home" aria-label="Volver" className="rounded-full p-2 text-muted-foreground hover:bg-muted lg:hidden">
              <ArrowLeft className="size-4" />
            </Link>
            <NexusAvatar pulse={isTyping} />
            <div className="min-w-0 leading-tight">
              <p className="text-sm font-semibold">Nexus IA</p>
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className={cn("size-1.5 rounded-full", isTyping ? "animate-pulse bg-brand-purple" : "bg-brand-emerald")} />
                {isTyping ? "Pensando…" : "Coach de liderazgo y clima laboral"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 lg:hidden">
            <button type="button" onClick={() => setShowHistory(true)} aria-label="Ver historial" className="rounded-full p-2 text-muted-foreground hover:bg-muted">
              <History className="size-4" />
            </button>
            <button type="button" onClick={() => void newSession()} aria-label="Nueva conversación" className="rounded-full p-2 text-muted-foreground hover:bg-muted">
              <Plus className="size-4" />
            </button>
          </div>
        </header>

        {/* Mensajes */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {isEmpty ? (
            <div className="mx-auto flex min-h-full max-w-2xl flex-col items-center justify-center px-5 py-8 text-center sm:py-10 duration-500 animate-in fade-in zoom-in-95">
              <NexusAvatar size="lg" />
              <h2 className="mt-5 text-2xl font-semibold tracking-tight sm:text-3xl">
                ¿En qué te ayudo{" "}
                <span className="bg-gradient-to-r from-brand-blue to-brand-purple bg-clip-text text-transparent">hoy</span>?
              </h2>
              {welcome ? (
                <div
                  className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground [&_strong]:font-semibold [&_strong]:text-foreground"
                  dangerouslySetInnerHTML={{ __html: parseMarkdown(welcome.content) }}
                />
              ) : null}

              <div className="mt-6 grid w-full grid-cols-1 gap-2 sm:mt-8 sm:grid-cols-2 sm:gap-3">
                {COACHING_CASES.map(({ icon: Icon, title, text }) => (
                  <button
                    key={title}
                    type="button"
                    onClick={() => void startCaseSession(text)}
                    disabled={busy}
                    className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left sm:items-start sm:p-4 transition hover:-translate-y-0.5 hover:border-brand-purple/40 hover:shadow-lg hover:shadow-brand-purple/5 disabled:pointer-events-none disabled:opacity-50"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-purple/10 text-brand-purple transition group-hover:bg-brand-purple group-hover:text-white">
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{title}</span>
                      <span className="mt-0.5 hidden text-xs text-muted-foreground sm:block">{text}</span>
                    </span>
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => void handleGenerateCase()}
                disabled={busy}
                className="mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-brand-purple transition hover:bg-brand-purple/10 disabled:opacity-50"
              >
                <Wand2 className={cn("size-4", isGeneratingCase && "animate-spin")} />
                {isGeneratingCase ? "Preparando un caso para ti…" : "Sorpréndeme con un caso de coaching"}
              </button>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
              {messages.map((message, idx) => (
                <MessageRow
                  key={message.id}
                  message={message}
                  isStreaming={isTyping && idx === messages.length - 1 && message.role === "assistant"}
                />
              ))}

              {showTypingDots ? (
                <div className="flex items-center gap-3 duration-300 animate-in fade-in">
                  <NexusAvatar pulse />
                  <div className="flex items-center gap-1.5 rounded-full bg-muted px-4 py-3">
                    <span className="size-2 animate-bounce rounded-full bg-brand-blue [animation-delay:-0.3s]" />
                    <span className="size-2 animate-bounce rounded-full bg-sky-500 [animation-delay:-0.15s]" />
                    <span className="size-2 animate-bounce rounded-full bg-brand-purple" />
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Redacción */}
        <div className="px-4 pb-4 pt-2 max-lg:pb-6 sm:px-6">
          <div className="mx-auto max-w-3xl">
            {error ? (
              <p className="mb-2 rounded-2xl border border-brand-red/30 bg-brand-red/5 px-4 py-2 text-xs text-brand-red">{error}</p>
            ) : null}
            <form
              onSubmit={(event) => {
                event.preventDefault();
                submit();
              }}
              className="flex items-end gap-2 rounded-[28px] border border-border bg-card p-2 pl-5 shadow-lg shadow-slate-900/5 transition focus-within:border-brand-purple/40 focus-within:shadow-brand-purple/10"
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder="Pregunta a Nexus IA sobre tu equipo…"
                aria-label="Mensaje para Nexus IA"
                className="max-h-[168px] min-h-[40px] flex-1 resize-none bg-transparent py-2.5 text-[15px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground"
              />
              <button
                type="submit"
                disabled={isTyping || !input.trim()}
                aria-label="Enviar mensaje"
                className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-blue to-brand-purple text-white shadow-md transition hover:scale-105 active:scale-95 disabled:scale-100 disabled:from-muted disabled:to-muted disabled:text-muted-foreground disabled:shadow-none"
              >
                <ArrowUp className="size-5" />
              </button>
            </form>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Nexus IA puede cometer errores. Verifica la información importante antes de actuar.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
