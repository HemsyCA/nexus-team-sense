import { createFileRoute } from "@tanstack/react-router";
import { Sparkles, ArrowRight, Play } from "lucide-react";
import { AppLayout, Card } from "@/components/AppLayout";
import { requireAuth } from "@/lib/auth-guard";

export const Route = createFileRoute("/simulaciones")({
  beforeLoad: requireAuth,
  head: () => ({
    meta: [
      { title: "Simulaciones · NEXUS LEAD IA" },
      {
        name: "description",
        content: "Simula el impacto organizacional de tus decisiones con IA.",
      },
    ],
  }),
  component: SimPage,
});

const metrics = [
  { label: "Estrés", a: 78, b: 32, better: "lower" as const, color: "bg-brand-red" },
  { label: "Motivación", a: 48, b: 74, better: "higher" as const, color: "bg-brand-emerald" },
  { label: "Clima Laboral", a: 55, b: 80, better: "higher" as const, color: "bg-brand-blue" },
  { label: "Productividad", a: 60, b: 78, better: "higher" as const, color: "bg-brand-purple" },
  { label: "Confianza en el Líder", a: 52, b: 81, better: "higher" as const, color: "bg-brand-emerald" },
];

function SimPage() {
  return (
    <AppLayout
      title="Simulación Organizacional"
      subtitle="Compara escenarios y anticipa el impacto humano de tu decisión"
    >
      {/* Decision input */}
      <Card className="mb-6">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Decisión a evaluar
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          <textarea
            defaultValue="Cambiar el horario de reuniones de 8:00 AM a 7:00 AM"
            className="resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15"
            rows={2}
          />
          <button className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-navy px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-navy/90">
            <Play className="size-4" />
            Simular con IA
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
          {[
            "Reducir reuniones semanales",
            "Implementar viernes corto",
            "Rotar líderes de proyecto",
          ].map((s) => (
            <button
              key={s}
              className="rounded-full border border-border bg-background px-3 py-1 font-medium text-muted-foreground transition hover:border-brand-blue hover:text-brand-blue"
            >
              {s}
            </button>
          ))}
        </div>
      </Card>

      {/* Scenarios */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ScenarioCard
          tone="warn"
          tag="Escenario A"
          subtitle="Decisión original"
          title="Reuniones a las 7:00 AM"
          desc="Probable resistencia, fatiga matutina y caída de la motivación en el equipo."
        />
        <ScenarioCard
          tone="ok"
          tag="Escenario B"
          subtitle="Recomendación de Nexus IA"
          title="Reuniones a las 9:30 AM, lunes y jueves"
          desc="Menor carga matutina, mejor preparación y mayor calidad en las decisiones."
        />
      </section>

      {/* Comparison */}
      <Card className="mt-6">
        <div className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold">Comparación de impacto</h2>
            <p className="text-xs text-muted-foreground">
              Proyección de Nexus IA basada en patrones históricos del equipo
            </p>
          </div>
          <div className="flex shrink-0 gap-4 text-[11px]">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="size-2 rounded-full bg-muted-foreground/40" /> Esc. A
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="size-2 rounded-full bg-brand-emerald" /> Esc. B
            </span>
          </div>
        </div>

        <ul className="space-y-5">
          {metrics.map((m) => {
            const better =
              m.better === "higher" ? m.b > m.a : m.b < m.a;
            const delta = m.b - m.a;
            return (
              <li key={m.label} className="grid grid-cols-[10rem_minmax(0,1fr)_4rem] items-center gap-4">
                <span className="truncate text-sm font-medium">{m.label}</span>
                <div className="space-y-1.5">
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-muted-foreground/40"
                      style={{ width: `${m.a}%` }}
                    />
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-brand-emerald"
                      style={{ width: `${m.b}%` }}
                    />
                  </div>
                </div>
                <span
                  className={
                    "text-right text-xs font-bold " +
                    (better ? "text-brand-emerald" : "text-brand-red")
                  }
                >
                  {delta > 0 ? "+" : ""}
                  {delta}%
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
              <p className="mt-2 text-sm leading-relaxed text-white/85">
                El <strong>Escenario B</strong> reduce el estrés en un{" "}
                <strong className="text-brand-emerald">−46%</strong> y aumenta
                la confianza en el liderazgo en{" "}
                <strong className="text-brand-emerald">+29%</strong>. Recomiendo
                comunicar el cambio con 48h de anticipación.
              </p>
              <button className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-xs font-bold text-brand-navy transition hover:bg-brand-blue/90">
                Aplicar recomendación
                <ArrowRight className="size-3" />
              </button>
            </div>
          </div>
        </div>
      </Card>
    </AppLayout>
  );
}

function ScenarioCard({
  tone,
  tag,
  subtitle,
  title,
  desc,
}: {
  tone: "warn" | "ok";
  tag: string;
  subtitle: string;
  title: string;
  desc: string;
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
    <div className={`rounded-2xl border p-6 shadow-sm ${tones}`}>
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
    </div>
  );
}
