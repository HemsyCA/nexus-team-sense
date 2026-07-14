import { createFileRoute } from "@tanstack/react-router";
import { Sparkles, ArrowRight, Play, RefreshCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { AppLayout, Card } from "@/components/AppLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { requireAuthAndOnboarded } from "@/lib/auth-guard";
import { supabase } from "@/lib/supabase";
import { generateAlternatives, simulateOutcome } from "@/lib/api/simulation.functions";

export const Route = createFileRoute("/simulaciones")({
  beforeLoad: requireAuthAndOnboarded,
  head: () => ({
    meta: [
      { title: "Simulaciones · NEXUS LEAD IA" },
      {
        name: "description",
        content: "Simula el impacto organizacional de tus decisiones con IA.",
      },
    ],
  }),
  component: () => (
    <ProtectedRoute>
      <SimPage />
    </ProtectedRoute>
  ),
});

type Alternative = { id: string; title: string; description: string };
type ProjectedMetrics = Record<string, { before: number; after: number }>;
type Outcome = {
  summary: string;
  risk_level: "low" | "medium" | "high" | "critical";
  risk_score: number;
  recommendations: string[];
  projected_metrics: ProjectedMetrics;
};

const METRIC_LABELS: Record<string, { label: string; better: "higher" | "lower"; color: string }> = {
  estres: { label: "Estrés", better: "lower", color: "bg-brand-red" },
  motivacion: { label: "Motivación", better: "higher", color: "bg-brand-emerald" },
  clima: { label: "Clima Laboral", better: "higher", color: "bg-brand-blue" },
  productividad: { label: "Productividad", better: "higher", color: "bg-brand-purple" },
  confianza: { label: "Confianza en el Líder", better: "higher", color: "bg-brand-emerald" },
};

const SUGGESTIONS = ["Reducir reuniones semanales", "Implementar viernes corto", "Rotar líderes de proyecto"];

const RISK_STYLES: Record<Outcome["risk_level"], string> = {
  low: "bg-brand-emerald/15 text-brand-emerald",
  medium: "bg-brand-amber/15 text-brand-amber",
  high: "bg-brand-red/15 text-brand-red",
  critical: "bg-brand-red/25 text-brand-red",
};

function SimPage() {
  const [decision, setDecision] = useState("Cambiar el horario de reuniones de 8:00 AM a 7:00 AM");
  const [context, setContext] = useState<string | undefined>(undefined);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [alternatives, setAlternatives] = useState<Alternative[] | null>(null);
  const [chosen, setChosen] = useState<Alternative | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [isLoadingAlternatives, setIsLoadingAlternatives] = useState(false);
  const [isLoadingOutcome, setIsLoadingOutcome] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: profile } = await supabase
        .from("digital_twin_profiles")
        .select("leadership_style, collaboration_index, stress_resilience")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (profile) {
        setContext(
          `Estilo de liderazgo: ${profile.leadership_style ?? "N/A"}. Índice de colaboración: ${profile.collaboration_index ?? "N/A"}/100. Resiliencia al estrés: ${profile.stress_resilience ?? "N/A"}/100.`,
        );
      }
    })();
  }, []);

  function resetSimulation() {
    setSessionId(null);
    setAlternatives(null);
    setChosen(null);
    setOutcome(null);
    setError(null);
  }

  async function handleSimulate() {
    const trimmed = decision.trim();
    if (!trimmed || isLoadingAlternatives) return;

    resetSimulation();
    setIsLoadingAlternatives(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No hay sesión activa.");

      const { data: newSession, error: sessionError } = await supabase
        .from("simulation_sessions")
        .insert([{ user_id: session.user.id, title: trimmed.slice(0, 60), scenario_type: "decision", context_snapshot: { decision: trimmed }, status: "active" }])
        .select()
        .single();
      if (sessionError || !newSession) throw sessionError ?? new Error("No se pudo crear la sesión de simulación.");

      setSessionId(newSession.id);

      await supabase.from("simulation_messages").insert([{ session_id: newSession.id, user_id: session.user.id, role: "user", content: trimmed }]);

      const result = await generateAlternatives({ data: { decision: trimmed, context } });

      await supabase.from("simulation_messages").insert([
        { session_id: newSession.id, user_id: session.user.id, role: "assistant", content: "Alternativas propuestas por Nexus IA.", metadata: { alternatives: result.alternatives } },
      ]);

      setAlternatives(result.alternatives);
    } catch (err) {
      console.error("Error generando alternativas", err);
      setError(err instanceof Error ? err.message : "No se pudieron generar alternativas.");
    } finally {
      setIsLoadingAlternatives(false);
    }
  }

  async function handleChoose(alternative: Alternative) {
    if (!sessionId || isLoadingOutcome) return;

    setChosen(alternative);
    setIsLoadingOutcome(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No hay sesión activa.");

      await supabase.from("simulation_messages").insert([
        { session_id: sessionId, user_id: session.user.id, role: "user", content: `Elijo: ${alternative.title}`, metadata: { chosen_alternative_id: alternative.id } },
      ]);

      const result = await simulateOutcome({ data: { decision, chosenAlternative: alternative, context } });

      await supabase.from("simulation_outcomes").insert([
        {
          session_id: sessionId,
          summary: result.summary,
          risk_score: result.risk_score,
          risk_level: result.risk_level,
          recommendations: { tips: result.recommendations, projected_metrics: result.projected_metrics },
        },
      ]);
      await supabase.from("simulation_sessions").update({ status: "completed", ended_at: new Date().toISOString() }).eq("id", sessionId);

      setOutcome(result);
    } catch (err) {
      console.error("Error simulando resultado", err);
      setError(err instanceof Error ? err.message : "No se pudo simular el resultado.");
    } finally {
      setIsLoadingOutcome(false);
    }
  }

  return (
    <AppLayout
      title="Simulación Organizacional"
      subtitle="Nexus IA propone alternativas y simula el impacto de la que elijas"
    >
      {/* Decision input */}
      <Card className="mb-6">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Decisión a evaluar
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          <textarea
            value={decision}
            onChange={(e) => setDecision(e.target.value)}
            className="resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15"
            rows={2}
          />
          <button
            onClick={() => void handleSimulate()}
            disabled={isLoadingAlternatives || !decision.trim()}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-navy px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-navy/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Play className="size-4" />
            {isLoadingAlternatives ? "Generando alternativas…" : "Simular con IA"}
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setDecision(s)}
              className="rounded-full border border-border bg-background px-3 py-1 font-medium text-muted-foreground transition hover:border-brand-blue hover:text-brand-blue"
            >
              {s}
            </button>
          ))}
        </div>
      </Card>

      {error && (
        <div className="mb-6 rounded-xl border border-brand-red/30 bg-brand-red/5 p-3 text-sm text-brand-red">
          {error}
        </div>
      )}

      {/* Alternatives proposed by the AI */}
      {alternatives && !outcome && (
        <section className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-muted-foreground">Elige una alternativa para simular</h2>
            <button onClick={resetSimulation} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
              <RefreshCcw className="size-3" /> Empezar de nuevo
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {alternatives.map((alt) => (
              <ScenarioCard
                key={alt.id}
                tone={chosen?.id === alt.id ? "ok" : "warn"}
                tag={chosen?.id === alt.id ? "Elegida" : "Alternativa"}
                subtitle="Propuesta de Nexus IA"
                title={alt.title}
                desc={alt.description}
                onClick={() => void handleChoose(alt)}
                disabled={isLoadingOutcome}
              />
            ))}
          </div>
          {isLoadingOutcome && (
            <p className="mt-4 text-center text-xs text-muted-foreground">Simulando el impacto de tu decisión…</p>
          )}
        </section>
      )}

      {/* Outcome */}
      {outcome && chosen && (
        <Card className="mt-6">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-lg font-bold">Comparación de impacto</h2>
              <p className="text-xs text-muted-foreground">
                Proyección de Nexus IA tras elegir: <strong>{chosen.title}</strong>
              </p>
            </div>
            <span className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold uppercase ${RISK_STYLES[outcome.risk_level]}`}>
              Riesgo {outcome.risk_level} · {outcome.risk_score}/10
            </span>
          </div>

          <ul className="space-y-5">
            {Object.entries(outcome.projected_metrics).map(([key, values]) => {
              const meta = METRIC_LABELS[key] ?? { label: key, better: "higher" as const, color: "bg-brand-blue" };
              const better = meta.better === "higher" ? values.after > values.before : values.after < values.before;
              const delta = Math.round(values.after - values.before);
              return (
                <li key={key} className="grid grid-cols-[10rem_minmax(0,1fr)_4rem] items-center gap-4">
                  <span className="truncate text-sm font-medium">{meta.label}</span>
                  <div className="space-y-1.5">
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full bg-muted-foreground/40" style={{ width: `${Math.min(100, Math.max(0, values.before))}%` }} />
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className={`h-full ${meta.color}`} style={{ width: `${Math.min(100, Math.max(0, values.after))}%` }} />
                    </div>
                  </div>
                  <span className={"text-right text-xs font-bold " + (better ? "text-brand-emerald" : "text-brand-red")}>
                    {delta > 0 ? "+" : ""}
                    {delta}
                  </span>
                </li>
              );
            })}
          </ul>

          <div className="mt-8 rounded-2xl bg-brand-navy p-5 text-white">
            <div className="flex items-start gap-3">
              <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-purple/20 text-brand-purple">
                <Sparkles className="size-4" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-brand-blue">
                  Conclusión de Nexus IA
                </p>
                <p className="mt-2 text-sm leading-relaxed text-white/85">{outcome.summary}</p>
                {outcome.recommendations.length > 0 && (
                  <ul className="mt-3 space-y-1.5 text-sm text-white/75">
                    {outcome.recommendations.map((rec) => (
                      <li key={rec} className="flex items-start gap-2">
                        <ArrowRight className="mt-0.5 size-3 shrink-0 text-brand-blue" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  onClick={resetSimulation}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-xs font-bold text-brand-navy transition hover:bg-brand-blue/90"
                >
                  Simular otra decisión
                  <ArrowRight className="size-3" />
                </button>
              </div>
            </div>
          </div>
        </Card>
      )}
    </AppLayout>
  );
}

function ScenarioCard({
  tone,
  tag,
  subtitle,
  title,
  desc,
  onClick,
  disabled,
}: {
  tone: "warn" | "ok";
  tag: string;
  subtitle: string;
  title: string;
  desc: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const tones =
    tone === "ok"
      ? "border-brand-emerald/30 bg-brand-emerald/5"
      : "border-border bg-card";
  const tagColor =
    tone === "ok"
      ? "bg-brand-emerald/15 text-brand-emerald"
      : "bg-muted text-muted-foreground";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-2xl border p-6 text-left shadow-sm transition hover:border-brand-blue disabled:cursor-not-allowed disabled:opacity-60 ${tones}`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${tagColor}`}
        >
          {tag}
        </span>
        <span className="text-[11px] text-muted-foreground">{subtitle}</span>
      </div>
      <h3 className="mt-4 text-lg font-bold tracking-tight">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{desc}</p>
    </button>
  );
}
