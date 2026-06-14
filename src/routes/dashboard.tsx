import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, TrendingUp, TrendingDown, Download } from "lucide-react";
import { AppLayout, Card } from "@/components/AppLayout";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard · NEXUS LEAD IA" },
      {
        name: "description",
        content: "Indicadores anónimos de clima, estrés, motivación y burnout.",
      },
    ],
  }),
  component: DashboardPage,
});

// Sparkline-like SVG generator
function LineChart({ color = "var(--brand-blue)" }: { color?: string }) {
  const points = [10, 28, 22, 40, 32, 52, 48, 60, 55, 72, 68, 80];
  const max = 100;
  const w = 100;
  const h = 40;
  const d = points
    .map((v, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - (v / max) * h;
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");
  const area = `${d} L${w},${h} L0,${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-20 w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`g-${color}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#g-${color})`} />
      <path d={d} stroke={color} strokeWidth="1.5" fill="none" />
    </svg>
  );
}

function DashboardPage() {
  return (
    <AppLayout
      title="Dashboard Anónimo"
      subtitle="Datos agregados del equipo · sin identidades reales"
    >
      <div className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="flex flex-wrap gap-2">
          {["7 días", "30 días", "Trimestre"].map((p, i) => (
            <button
              key={p}
              className={
                "rounded-full px-3 py-1.5 text-xs font-semibold transition " +
                (i === 1
                  ? "bg-brand-navy text-white"
                  : "border border-border bg-card text-muted-foreground hover:text-foreground")
              }
            >
              {p}
            </button>
          ))}
        </div>
        <button className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground transition hover:border-brand-blue">
          <Download className="size-3.5" />
          Exportar reporte
        </button>
      </div>

      {/* KPI charts */}
      <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Clima Laboral", value: "84%", delta: "+4%", up: true, color: "var(--brand-emerald)" },
          { label: "Nivel de Estrés", value: "32%", delta: "−6%", up: true, color: "var(--brand-blue)" },
          { label: "Motivación", value: "72%", delta: "+2%", up: true, color: "var(--brand-purple)" },
          { label: "Riesgo Burnout", value: "12%", delta: "+3%", up: false, color: "var(--brand-red)" },
        ].map((k) => (
          <Card key={k.label}>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {k.label}
            </p>
            <div className="mt-2 flex items-baseline justify-between">
              <h3 className="text-3xl font-bold tracking-tight">{k.value}</h3>
              <span
                className={
                  "flex items-center gap-1 text-xs font-semibold " +
                  (k.up ? "text-brand-emerald" : "text-brand-red")
                }
              >
                {k.up ? (
                  <TrendingUp className="size-3" />
                ) : (
                  <TrendingDown className="size-3" />
                )}
                {k.delta}
              </span>
            </div>
            <div className="mt-3">
              <LineChart color={k.color} />
            </div>
          </Card>
        ))}
      </section>

      {/* Main charts */}
      <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-8">
          <div className="mb-5 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
            <div className="min-w-0">
              <h2 className="text-lg font-bold">Evolución semanal del ambiente</h2>
              <p className="text-xs text-muted-foreground">
                Comparación clima, motivación y estrés · últimas 12 semanas
              </p>
            </div>
            <div className="flex shrink-0 gap-3 text-[11px]">
              <Legend color="bg-brand-emerald" label="Clima" />
              <Legend color="bg-brand-purple" label="Motivación" />
              <Legend color="bg-brand-red" label="Estrés" />
            </div>
          </div>
          <div className="relative h-64 w-full">
            <BarsChart />
          </div>
        </Card>

        <Card className="lg:col-span-4">
          <h2 className="text-lg font-bold">Emociones predominantes</h2>
          <p className="mb-5 text-xs text-muted-foreground">Análisis NLP semanal</p>
          <ul className="space-y-4">
            {[
              { label: "Cansancio", pct: 38, color: "bg-brand-red" },
              { label: "Motivación", pct: 27, color: "bg-brand-emerald" },
              { label: "Ansiedad", pct: 18, color: "bg-brand-amber" },
              { label: "Calma", pct: 11, color: "bg-brand-blue" },
              { label: "Orgullo", pct: 6, color: "bg-brand-purple" },
            ].map((e) => (
              <li key={e.label}>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="font-medium">{e.label}</span>
                  <span className="text-muted-foreground">{e.pct}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className={`h-full ${e.color}`} style={{ width: `${e.pct}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      {/* Participation + alerts */}
      <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-5">
          <h2 className="text-lg font-bold">Participación en el Feed</h2>
          <p className="mb-6 text-xs text-muted-foreground">
            Respuestas anónimas por área esta semana
          </p>
          <ul className="space-y-3">
            {[
              { area: "Operaciones", count: 48, pct: 92 },
              { area: "Ingeniería", count: 41, pct: 78 },
              { area: "Marketing", count: 28, pct: 65 },
              { area: "Recursos Humanos", count: 22, pct: 88 },
              { area: "Ventas", count: 17, pct: 42 },
            ].map((a) => (
              <li key={a.area} className="grid grid-cols-[8rem_minmax(0,1fr)_3rem] items-center gap-3 text-sm">
                <span className="truncate font-medium">{a.area}</span>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-blue to-brand-purple"
                    style={{ width: `${a.pct}%` }}
                  />
                </div>
                <span className="text-right text-xs text-muted-foreground">
                  {a.count}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="lg:col-span-7">
          <h2 className="mb-5 text-lg font-bold">Alertas detectadas por IA</h2>
          <ul className="space-y-3">
            {[
              {
                t: "Aumento del estrés en Operaciones",
                d: "Subió 14% en los últimos 7 días. Patrón vinculado a cambios de planificación.",
                level: "Alta",
                c: "border-brand-red/30 bg-brand-red/5 text-brand-red",
              },
              {
                t: "Disminución de motivación en Marketing",
                d: "Cayó 9% en 2 semanas. Recomendado abrir sesión de escucha activa.",
                level: "Media",
                c: "border-brand-amber/30 bg-brand-amber/5 text-brand-amber",
              },
              {
                t: "Fatiga sostenida en Ingeniería",
                d: "Riesgo de burnout en aumento. 3 reportes mencionan reuniones tempranas.",
                level: "Media",
                c: "border-brand-amber/30 bg-brand-amber/5 text-brand-amber",
              },
            ].map((a) => (
              <li
                key={a.t}
                className={"grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 rounded-xl border p-4 " + a.c}
              >
                <AlertTriangle className="size-4 shrink-0" />
                <div className="min-w-0 text-foreground">
                  <p className="truncate text-sm font-semibold">{a.t}</p>
                  <p className="text-xs text-muted-foreground">{a.d}</p>
                </div>
                <span className={"shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"}>
                  {a.level}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </section>
    </AppLayout>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-muted-foreground">
      <span className={`size-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function BarsChart() {
  const weeks = Array.from({ length: 12 }, (_, i) => ({
    clima: 50 + Math.sin(i / 2) * 12 + i * 1.5,
    motiv: 45 + Math.cos(i / 2) * 14 + i,
    estres: 70 - i * 1.8 + Math.sin(i) * 6,
  }));
  return (
    <div className="absolute inset-0 grid grid-cols-12 items-end gap-2">
      {weeks.map((w, i) => (
        <div key={i} className="flex h-full flex-col justify-end gap-1">
          <div
            className="rounded-t-sm bg-brand-emerald/80"
            style={{ height: `${w.clima}%` }}
          />
          <div
            className="rounded-t-sm bg-brand-purple/80"
            style={{ height: `${w.motiv * 0.7}%` }}
          />
          <div
            className="rounded-t-sm bg-brand-red/70"
            style={{ height: `${w.estres * 0.5}%` }}
          />
          <div className="text-center text-[9px] text-muted-foreground">
            S{i + 1}
          </div>
        </div>
      ))}
    </div>
  );
}
