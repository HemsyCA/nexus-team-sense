import { createFileRoute } from "@tanstack/react-router";
import { Sparkles, Send, AlertTriangle, Lightbulb, ArrowRight } from "lucide-react";
import { AppLayout, Card } from "@/components/AppLayout";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "Chat IA · NEXUS LEAD IA" },
      {
        name: "description",
        content: "Conversa con Nexus IA, tu asistente predictivo de clima laboral.",
      },
    ],
  }),
  component: ChatPage,
});

const suggestions = [
  "¿Cómo está el clima laboral esta semana?",
  "¿Qué factores están generando estrés?",
  "Dame una recomendación para mejorar la comunicación.",
  "Simula qué pasaría si cambio el horario de reuniones.",
];

function ChatPage() {
  return (
    <AppLayout title="Chat con Nexus IA" subtitle="Tu asistente predictivo de bienestar organizacional">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Chat panel */}
        <div className="lg:col-span-8">
          <div className="flex h-[calc(100vh-13rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            {/* Chat header */}
            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-5 py-4">
              <div className="grid size-10 place-items-center rounded-xl bg-brand-purple/15 text-brand-purple">
                <Sparkles className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold">Nexus IA</p>
                <p className="text-[11px] text-muted-foreground">
                  Conectado · Analiza 124 respuestas en tiempo real
                </p>
              </div>
              <span className="rounded-full bg-brand-emerald/10 px-2.5 py-1 text-[10px] font-semibold text-brand-emerald">
                Activo
              </span>
            </div>

            {/* Messages */}
            <div className="flex-1 space-y-5 overflow-y-auto p-6">
              <Bubble from="ai">
                Hola Laura. He analizado los comentarios de hoy. Detecté un
                patrón de fatiga en el equipo de Ingeniería y un aumento del
                estrés en Operaciones. ¿Por dónde te gustaría empezar?
              </Bubble>

              <Bubble from="user">
                ¿Qué factores están generando estrés esta semana?
              </Bubble>

              <Bubble from="ai">
                Identifiqué tres factores recurrentes en los últimos 7 días:
                <ul className="mt-3 space-y-2 text-sm">
                  <li className="flex gap-2">
                    <span className="text-brand-blue">•</span> Cambios de
                    última hora en planificación (mencionado por 14 personas)
                  </li>
                  <li className="flex gap-2">
                    <span className="text-brand-blue">•</span> Reuniones
                    matutinas a las 8:00 AM
                  </li>
                  <li className="flex gap-2">
                    <span className="text-brand-blue">•</span> Falta de
                    feedback claro tras entregas
                  </li>
                </ul>
              </Bubble>

              {/* AI alert card */}
              <Bubble from="ai" raw>
                <Card className="border-brand-red/20 bg-brand-red/5">
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-brand-red/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-red">
                    <AlertTriangle className="size-3" /> Alerta de Burnout
                  </div>
                  <p className="text-sm leading-relaxed">
                    El área de Operaciones supera el umbral de fatiga sostenida
                    durante 5 días. Se recomienda suspender reuniones no
                    críticas por 48 horas.
                  </p>
                  <button className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-brand-red hover:underline">
                    Ver detalle del área
                    <ArrowRight className="size-3" />
                  </button>
                </Card>
              </Bubble>

              <Bubble from="ai" raw>
                <Card className="border-brand-emerald/20 bg-brand-emerald/5">
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-brand-emerald/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-emerald">
                    <Lightbulb className="size-3" /> Acción Sugerida
                  </div>
                  <p className="text-sm leading-relaxed">
                    Mover la reunión de inicio de día a las 9:30 AM reduce el
                    estrés estimado en <strong>−32%</strong> y mejora la
                    motivación en <strong>+18%</strong>.
                  </p>
                  <button className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-emerald px-3 py-2 text-xs font-semibold text-white hover:bg-brand-emerald/90">
                    Simular este cambio
                    <ArrowRight className="size-3" />
                  </button>
                </Card>
              </Bubble>
            </div>

            {/* Composer */}
            <div className="border-t border-border bg-background/40 p-4">
              <form
                onSubmit={(e) => e.preventDefault()}
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-xl border border-border bg-card px-3 py-2 focus-within:border-brand-blue focus-within:ring-2 focus-within:ring-brand-blue/15"
              >
                <input
                  className="bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  placeholder="Pregunta a Nexus IA…"
                />
                <button className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-navy text-white transition hover:bg-brand-navy/90">
                  <Send className="size-4" />
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Suggestions */}
        <aside className="space-y-5 lg:col-span-4">
          <Card>
            <h3 className="text-sm font-bold">Preguntas sugeridas</h3>
            <p className="mb-4 text-[11px] text-muted-foreground">
              Toca para enviar a Nexus IA
            </p>
            <ul className="space-y-2">
              {suggestions.map((q) => (
                <li key={q}>
                  <button className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border bg-background px-3 py-3 text-left text-sm font-medium transition hover:border-brand-blue hover:bg-brand-blue/5">
                    <span className="truncate">{q}</span>
                    <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="bg-brand-navy text-white">
            <div className="text-xs font-semibold uppercase tracking-wider text-brand-blue">
              Modelo Nexus IA · v2.4
            </div>
            <p className="mt-3 text-sm leading-relaxed text-white/80">
              Tono profesional, breve y empático. Las respuestas se basan en
              comentarios anónimos del equipo y datos agregados — nunca
              identifica personas.
            </p>
          </Card>
        </aside>
      </div>
    </AppLayout>
  );
}

function Bubble({
  from,
  children,
  raw = false,
}: {
  from: "ai" | "user";
  children: React.ReactNode;
  raw?: boolean;
}) {
  if (from === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-brand-navy px-4 py-3 text-sm text-white">
          {children}
        </div>
      </div>
    );
  }
  return (
    <div className="flex max-w-[85%] gap-3">
      <div className="mt-1 grid size-7 shrink-0 place-items-center rounded-lg bg-brand-purple/15 text-brand-purple">
        <Sparkles className="size-3.5" />
      </div>
      {raw ? (
        <div className="w-full">{children}</div>
      ) : (
        <div className="rounded-2xl rounded-tl-md bg-muted px-4 py-3 text-sm leading-relaxed text-foreground">
          {children}
        </div>
      )}
    </div>
  );
}
