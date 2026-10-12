import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, TrendingUp, TrendingDown, Download } from "lucide-react";
import { useEffect, useState } from "react";
import { AppLayout, Card } from "@/components/AppLayout";
import { NexusChat } from "@/components/NexusChat";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { requireAuthAndOnboarded } from "@/lib/auth-guard";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: requireAuthAndOnboarded,
  head: () => ({
    meta: [
      { title: "Dashboard · NEXUS LEAD IA" },
      {
        name: "description",
        content: "Indicadores anónimos de clima, estrés, motivación y burnout.",
      },
    ],
  }),
  component: () => (
    <ProtectedRoute>
      <DashboardPage />
    </ProtectedRoute>
  ),
});

type OrgIndicators = {
  burnout_avg: number | null;
  stress_avg: number | null;
  motivation_avg: number | null;
  energy_avg: number | null;
  pulse_stress_avg: number | null;
  pulse_motivation_avg: number | null;
  users_pulsed_today: number | null;
  comments_24h: number | null;
  rotation_risk_score: number | null;
};

type DepartmentIndicator = {
  department_name: string | null;
  department_code: string | null;
  headcount: number | null;
  members_with_profile: number | null;
  is_reportable: boolean | null;
  burnout_avg: number | null;
  motivation_avg: number | null;
  rotation_risk_score: number | null;
  positive_count: number | null;
  negative_count: number | null;
  neutral_count: number | null;
  average_emotional_intelligence: number | null;
  average_collaboration: number | null;
  average_stress_resilience: number | null;
  average_empathy: number | null;
  feed_comments_count: number | null;
};

type TrendPoint = {
  pulse_date: string;
  stress_avg: number | null;
  motivation_avg: number | null;
  energy_avg: number | null;
  respondents: number | null;
};

type AlertItem = {
  type: string;
  message: string;
  department: string;
  severity: string;
};

function DashboardPage() {
  const [orgIndicators, setOrgIndicators] = useState<OrgIndicators | null>(null);
  const [departments, setDepartments] = useState<DepartmentIndicator[]>([]);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);

    try {
      // Aggregated views: RLS only lets each user read their own rows in the
      // base tables, so org/department numbers must come from these views
      // (departments with < 3 profiles come back with null metrics).
      const [org, depts, trendRes, alertRes] = await Promise.all([
        supabase.from("org_indicators").select("*").maybeSingle(),
        supabase.from("dept_indicators").select("*"),
        supabase.from("pulse_trend_14d").select("*").order("pulse_date", { ascending: true }),
        supabase.rpc("get_active_alerts"),
      ]);

      const firstError = org.error ?? depts.error ?? trendRes.error ?? alertRes.error;
      if (firstError) throw firstError;

      const departmentRows = (depts.data as DepartmentIndicator[] | null) ?? [];

      setOrgIndicators((org.data as OrgIndicators | null) ?? null);
      setDepartments(departmentRows.sort((a, b) => (b.rotation_risk_score ?? 0) - (a.rotation_risk_score ?? 0)));
      setTrend((trendRes.data as TrendPoint[] | null) ?? []);
      setAlerts(((alertRes.data as AlertItem[] | null) ?? []).filter(Boolean));
    } catch (err) {
      console.error("Error cargando dashboard", err);
      setError("No se pudieron cargar los indicadores desde Supabase.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();

    // Realtime on daily_pulse/daily_feeds only delivers the user's own rows
    // under RLS, so refresh the aggregates periodically instead.
    const interval = window.setInterval(() => void loadData(), 60_000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const climatePct = Math.max(0, Math.min(100, Math.round(((orgIndicators?.pulse_motivation_avg ?? 7) / 10) * 100)));
  const stressPct = Math.max(0, Math.min(100, Math.round(((orgIndicators?.pulse_stress_avg ?? 3) / 10) * 100)));
  const motivationPct = Math.max(0, Math.min(100, Math.round(((orgIndicators?.pulse_motivation_avg ?? 7) / 10) * 100)));
  const burnoutPct = Math.max(0, Math.min(100, Math.round(((orgIndicators?.burnout_avg ?? 1.2) / 10) * 100)));

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

      {error ? (
        <div className="mb-6 rounded-xl border border-brand-red/30 bg-brand-red/5 p-4 text-sm text-brand-red">
          {error}
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Clima Laboral", value: `${climatePct}%`, delta: `+${orgIndicators?.users_pulsed_today ?? 0} hoy`, up: true, color: "var(--brand-emerald)" },
          { label: "Nivel de Estrés", value: `${stressPct}%`, delta: `${orgIndicators?.pulse_stress_avg?.toFixed(1) ?? "0.0"}/10`, up: true, color: "var(--brand-blue)" },
          { label: "Motivación", value: `${motivationPct}%`, delta: `${orgIndicators?.pulse_motivation_avg?.toFixed(1) ?? "0.0"}/10`, up: true, color: "var(--brand-purple)" },
          { label: "Riesgo Burnout", value: `${burnoutPct}%`, delta: `${orgIndicators?.burnout_avg?.toFixed(1) ?? "0.0"}/10`, up: false, color: "var(--brand-red)" },
        ].map((k) => (
          <Card key={k.label}>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{k.label}</p>
            <div className="mt-2 flex items-baseline justify-between">
              <h3 className="text-3xl font-bold tracking-tight">{k.value}</h3>
              <span className={"flex items-center gap-1 text-xs font-semibold " + (k.up ? "text-brand-emerald" : "text-brand-red")}>
                {k.up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                {k.delta}
              </span>
            </div>
            <div className="mt-3">
              <LineChart color={k.color} />
            </div>
          </Card>
        ))}
      </section>

      <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-8">
          <div className="mb-5 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
            <div className="min-w-0">
              <h2 className="text-lg font-bold">Evolución semanal del ambiente</h2>
              <p className="text-xs text-muted-foreground">Datos provenientes de la vista de tendencia en Supabase</p>
            </div>
            <div className="flex shrink-0 gap-3 text-[11px]">
              <Legend color="bg-brand-emerald" label="Clima" />
              <Legend color="bg-brand-purple" label="Motivación" />
              <Legend color="bg-brand-red" label="Estrés" />
            </div>
          </div>
          <div className="relative h-64 w-full">
            <BarsChart trend={trend} />
          </div>
        </Card>

        <Card className="lg:col-span-4">
          <h2 className="text-lg font-bold">Participación por área</h2>
          <p className="mb-5 text-xs text-muted-foreground">Indicadores agregados desde Supabase</p>
          <ul className="space-y-4">
            {departments.slice(0, 5).map((dept) => (
              <li key={dept.department_name ?? "sin-area"}>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="font-medium">{dept.department_name ?? "Sin área"}</span>
                  <span className="text-muted-foreground">{dept.members_with_profile ?? 0}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-gradient-to-r from-brand-blue to-brand-purple" style={{ width: `${Math.min(100, ((dept.members_with_profile ?? 0) / Math.max(1, dept.headcount ?? 1)) * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-5">
          <h2 className="text-lg font-bold">Participación en el Feed</h2>
          <p className="mb-6 text-xs text-muted-foreground">Respuestas anónimas por área esta semana</p>
          <ul className="space-y-3">
            {departments.slice(0, 5).map((dept) => (
              <li key={`${dept.department_name}-feed`} className="grid grid-cols-[8rem_minmax(0,1fr)_3rem] items-center gap-3 text-sm">
                <span className="truncate font-medium">{dept.department_name ?? "Sin área"}</span>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-gradient-to-r from-brand-blue to-brand-purple" style={{ width: `${Math.min(100, ((dept.positive_count ?? 0) + (dept.neutral_count ?? 0)) * 2)}%` }} />
                </div>
                <span className="text-right text-xs text-muted-foreground">{dept.feed_comments_count ?? 0}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="lg:col-span-7">
          <h2 className="mb-5 text-lg font-bold">Resultados de tests por área</h2>
          <div className="space-y-3">
            {departments.slice(0, 5).map((dept) => (
              <div key={`${dept.department_name}-tests`} className="rounded-xl border border-border bg-background/60 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{dept.department_name ?? "Sin área"}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {dept.feed_comments_count ?? 0} comentarios · {dept.members_with_profile ?? 0} perfiles
                    </p>
                  </div>
                  <div className="text-right text-[11px] text-muted-foreground">
                    <p>IE: {dept.average_emotional_intelligence?.toFixed(0) ?? "—"}/100</p>
                    <p>Colab.: {dept.average_collaboration?.toFixed(0) ?? "—"}/100</p>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] text-muted-foreground">
                  <div className="rounded-lg bg-muted/60 p-2">
                    <p className="font-semibold text-foreground">{dept.average_stress_resilience?.toFixed(0) ?? "—"}</p>
                    <p>Resiliencia</p>
                  </div>
                  <div className="rounded-lg bg-muted/60 p-2">
                    <p className="font-semibold text-foreground">{dept.average_empathy?.toFixed(0) ?? "—"}</p>
                    <p>Empatía</p>
                  </div>
                  <div className="rounded-lg bg-muted/60 p-2">
                    <p className="font-semibold text-foreground">{dept.burnout_avg?.toFixed(1) ?? "—"}</p>
                    <p>Burnout</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-12">
          <h2 className="mb-5 text-lg font-bold">Alertas detectadas por IA</h2>
          <ul className="space-y-3">
            {alerts.length > 0 ? (
              alerts.map((alert) => (
                <li key={`${alert.type}-${alert.department}`} className={"grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 rounded-xl border p-4 " + (alert.severity === "critical" ? "border-brand-red/30 bg-brand-red/5 text-brand-red" : "border-brand-amber/30 bg-brand-amber/5 text-brand-amber")}>
                  <AlertTriangle className="size-4 shrink-0" />
                  <div className="min-w-0 text-foreground">
                    <p className="truncate text-sm font-semibold">{alert.message}</p>
                    <p className="text-xs text-muted-foreground">{alert.department}</p>
                  </div>
                  <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold">{alert.severity}</span>
                </li>
              ))
            ) : (
              <li className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                No hay alertas activas por el momento.
              </li>
            )}
          </ul>
        </Card>
      </section>

      <section className="relative z-10 mt-6 mb-24 lg:mb-0">
        <div className="mb-4">
          <h2 className="text-lg font-bold">Chat Nexus IA</h2>
          <p className="text-xs text-muted-foreground">Consulta en tiempo real sobre clima, estrés y bienestar del equipo</p>
        </div>
        <NexusChat />
      </section>
    </AppLayout>
  );
}

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

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-muted-foreground">
      <span className={`size-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function BarsChart({ trend }: { trend: TrendPoint[] }) {
  const points = trend.length > 0 ? trend : Array.from({ length: 7 }, (_, i) => ({ pulse_date: `D${i + 1}`, stress_avg: 4 + i * 0.2, motivation_avg: 6 + i * 0.1, energy_avg: 5 + i * 0.2, respondents: 10 + i }));

  return (
    <div className="absolute inset-0 grid grid-cols-12 items-end gap-2">
      {points.map((point, i) => {
        const climate = Math.max(8, Math.min(96, (Number(point.energy_avg ?? 5) / 10) * 100));
        const motivation = Math.max(8, Math.min(96, (Number(point.motivation_avg ?? 6) / 10) * 100));
        const stress = Math.max(8, Math.min(96, (Number(point.stress_avg ?? 4) / 10) * 100));
        return (
          <div key={`${point.pulse_date}-${i}`} className="flex h-full flex-col justify-end gap-1">
            <div className="rounded-t-sm bg-brand-emerald/80" style={{ height: `${climate}%` }} />
            <div className="rounded-t-sm bg-brand-purple/80" style={{ height: `${motivation}%` }} />
            <div className="rounded-t-sm bg-brand-red/70" style={{ height: `${stress}%` }} />
            <div className="text-center text-[9px] text-muted-foreground">{point.pulse_date.slice(-2)}</div>
          </div>
        );
      })}
    </div>
  );
}
