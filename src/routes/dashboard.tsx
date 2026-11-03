import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, AlertTriangle, CheckCircle2, Download, Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppLayout, Card } from "@/components/AppLayout";
import { KpiGrid } from "@/components/KpiGrid";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { requireAuthAndOnboarded } from "@/lib/auth-guard";
import { fmt, num, type AlertItem, type OrgIndicators } from "@/lib/indicators";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

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

type DepartmentIndicator = {
  department_id: string;
  department_name: string | null;
  members_with_profile: number | null;
  is_reportable: boolean | null;
  burnout_avg: number | null;
  stress_avg: number | null;
  motivation_avg: number | null;
  negative_count: number | null;
  feed_comments_count: number | null;
  average_emotional_intelligence: number | null;
  average_collaboration: number | null;
  average_stress_resilience: number | null;
  average_empathy: number | null;
  rotation_risk_score: number | null;
};

type TrendPoint = {
  day: string;
  stress_avg: number | null;
  motivation_avg: number | null;
  burnout_avg: number | null;
  comments: number | null;
};

const SERIES = [
  { key: "motivation_avg", label: "Motivación", color: "var(--chart-1)" },
  { key: "stress_avg", label: "Estrés", color: "var(--chart-2)" },
  { key: "burnout_avg", label: "Burnout", color: "var(--chart-3)" },
] as const;

function formatDay(day: string) {
  return new Date(`${day.slice(0, 10)}T00:00:00`).toLocaleDateString("es-PE", { day: "numeric", month: "short" });
}

function downloadCsv(departments: DepartmentIndicator[]) {
  const header = [
    "Área",
    "Perfiles",
    "Comentarios (7 días)",
    "Burnout",
    "Estrés",
    "Motivación",
    "Riesgo de rotación",
    "Inteligencia emocional",
    "Colaboración",
    "Resiliencia",
    "Empatía",
  ];
  const rows = departments.map((d) => [
    d.department_name ?? "Sin área",
    d.members_with_profile ?? 0,
    d.feed_comments_count ?? "",
    d.burnout_avg ?? "",
    d.stress_avg ?? "",
    d.motivation_avg ?? "",
    d.rotation_risk_score ?? "",
    d.average_emotional_intelligence ?? "",
    d.average_collaboration ?? "",
    d.average_stress_resilience ?? "",
    d.average_empathy ?? "",
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";"))
    .join("\r\n");

  // BOM + ";" so Excel in Spanish opens accents and columns correctly.
  const url = URL.createObjectURL(new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `nexus-indicadores-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function DashboardPage() {
  const [org, setOrg] = useState<OrgIndicators | null>(null);
  const [departments, setDepartments] = useState<DepartmentIndicator[]>([]);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  async function loadData() {
    // Aggregated views: RLS only lets each user read their own rows in the
    // base tables, so org/department numbers must come from these views
    // (departments with < 3 profiles come back with null metrics).
    const [orgRes, deptRes, trendRes, alertRes] = await Promise.all([
      supabase.from("org_indicators").select("*").maybeSingle(),
      supabase.from("dept_indicators").select("*"),
      supabase.from("climate_trend_14d").select("*").order("day", { ascending: true }),
      supabase.rpc("get_active_alerts"),
    ]);

    const firstError = orgRes.error ?? deptRes.error ?? trendRes.error ?? alertRes.error;
    if (firstError) console.error("Error cargando dashboard", firstError);
    setError(Boolean(firstError));

    if (!orgRes.error) setOrg((orgRes.data as OrgIndicators | null) ?? null);
    if (!deptRes.error) {
      const rows = (deptRes.data as DepartmentIndicator[] | null) ?? [];
      setDepartments(
        [...rows].sort(
          (a, b) =>
            (num(b.rotation_risk_score) ?? -1) - (num(a.rotation_risk_score) ?? -1) ||
            (a.department_name ?? "").localeCompare(b.department_name ?? ""),
        ),
      );
    }
    if (!trendRes.error) setTrend((trendRes.data as TrendPoint[] | null) ?? []);
    if (!alertRes.error) setAlerts((alertRes.data as AlertItem[] | null) ?? []);

    setUpdatedAt(new Date());
    setLoading(false);
  }

  useEffect(() => {
    void loadData();

    // Realtime on daily_pulse/daily_feeds only delivers the user's own rows
    // under RLS, so refresh the aggregates periodically instead.
    const interval = window.setInterval(() => void loadData(), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <AppLayout title="Dashboard" subtitle="Indicadores agregados del equipo · sin identidades">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Últimos 7 días
          {updatedAt
            ? ` · Actualizado a las ${updatedAt.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}`
            : ""}
        </p>
        <button
          type="button"
          onClick={() => downloadCsv(departments)}
          disabled={departments.length === 0}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="size-4" />
          Exportar CSV
        </button>
      </div>

      {error ? (
        <div
          role="alert"
          className="mb-6 flex items-center gap-3 rounded-xl border border-brand-amber/40 bg-brand-amber/10 px-4 py-3 text-sm text-foreground"
        >
          <AlertCircle className="size-4 shrink-0 text-brand-amber" />
          Algunos indicadores no están disponibles en este momento. Inténtalo de nuevo más tarde.
        </div>
      ) : null}

      <KpiGrid org={org} loading={loading} />

      {/* Tendencia + tono */}
      <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-12">
        <Card className="p-5 xl:col-span-8">
          <SectionTitle title="Evolución del clima" subtitle="Promedio diario de los últimos 14 días · escala 0 a 10" />
          <TrendChart trend={trend} />
        </Card>

        <Card className="p-5 xl:col-span-4">
          <SectionTitle title="Participación" subtitle="Comentarios del feed · últimos 7 días" />
          <ParticipationPanel org={org} />
        </Card>
      </section>

      {/* Alertas */}
      <Card className="mt-6 p-5">
        <SectionTitle title="Alertas activas" subtitle="Áreas que superan los umbrales de riesgo" />
        {alerts.length > 0 ? (
          <ul className="divide-y divide-border">
            {alerts.map((alert) => {
              const critical = alert.severity === "critical";
              return (
                <li key={`${alert.type}-${alert.department}`} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <AlertTriangle className={cn("size-4 shrink-0", critical ? "text-brand-red" : "text-brand-amber")} />
                  <span className="min-w-0 flex-1 truncate text-sm">{alert.message}</span>
                  <span className="shrink-0 text-xs font-medium text-muted-foreground">{critical ? "Crítica" : "Alta"}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            {error ? null : <CheckCircle2 className="size-4 text-brand-emerald" />}
            {error ? "Sin información de alertas por el momento." : "No hay alertas activas."}
          </p>
        )}
      </Card>

      {/* Tablas por área */}
      <Card className="mt-6 p-5">
        <SectionTitle title="Indicadores por área" subtitle="Ordenado por riesgo de rotación · últimos 7 días" />
        <DepartmentTable
          departments={departments}
          columns={[
            { label: "Comentarios", value: (d) => String(num(d.feed_comments_count) ?? 0) },
            { label: "Burnout", value: (d) => fmt(num(d.burnout_avg)) },
            { label: "Estrés", value: (d) => fmt(num(d.stress_avg)) },
            { label: "Motivación", value: (d) => fmt(num(d.motivation_avg)) },
            { label: "Riesgo de rotación", value: (d) => fmt(num(d.rotation_risk_score)) },
          ]}
        />
      </Card>

      <Card className="mt-6 p-5">
        <SectionTitle title="Competencias por área" subtitle="Promedio de los tests del gemelo digital · escala 0 a 100" />
        <DepartmentTable
          departments={departments}
          columns={[
            { label: "Int. emocional", value: (d) => fmt(num(d.average_emotional_intelligence), 0) },
            { label: "Colaboración", value: (d) => fmt(num(d.average_collaboration), 0) },
            { label: "Resiliencia", value: (d) => fmt(num(d.average_stress_resilience), 0) },
            { label: "Empatía", value: (d) => fmt(num(d.average_empathy), 0) },
          ]}
        />
      </Card>

      <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Lock className="size-3 shrink-0" />
        Para proteger el anonimato, las áreas con menos de 3 perfiles no muestran resultados.
      </p>
    </AppLayout>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function TrendTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: string;
  payload?: Array<{ dataKey?: unknown; value?: unknown; color?: string }>;
}) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-popover-foreground">{formatDay(label)}</p>
      {SERIES.map((series) => {
        const entry = payload.find((p) => p.dataKey === series.key);
        return (
          <p key={series.key} className="flex items-center justify-between gap-4 text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: series.color }} />
              {series.label}
            </span>
            <span className="font-medium tabular-nums text-popover-foreground">{fmt(num(entry?.value))}</span>
          </p>
        );
      })}
    </div>
  );
}

function TrendChart({ trend }: { trend: TrendPoint[] }) {
  if (trend.length === 0) {
    return <p className="py-16 text-center text-sm text-muted-foreground">Aún no hay datos para mostrar la tendencia.</p>;
  }

  const data = trend.map((point) => ({
    day: point.day,
    motivation_avg: num(point.motivation_avg),
    stress_avg: num(point.stress_avg),
    burnout_avg: num(point.burnout_avg),
  }));
  const sparse = data.length <= 3;

  return (
    <>
      <ul className="mb-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
        {SERIES.map((series) => (
          <li key={series.key} className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full" style={{ background: series.color }} />
            {series.label}
          </li>
        ))}
      </ul>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -24 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="day"
              tickFormatter={formatDay}
              tickLine={false}
              axisLine={false}
              minTickGap={32}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            />
            <YAxis
              domain={[0, 10]}
              ticks={[0, 2, 4, 6, 8, 10]}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            />
            <Tooltip content={<TrendTooltip />} cursor={{ stroke: "var(--border)" }} />
            {SERIES.map((series) => (
              <Line
                key={series.key}
                type="monotone"
                dataKey={series.key}
                name={series.label}
                stroke={series.color}
                strokeWidth={2}
                dot={sparse ? { r: 4, strokeWidth: 2, stroke: "var(--card)", fill: series.color } : false}
                activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-3 text-xs text-muted-foreground">
        <summary className="cursor-pointer select-none hover:text-foreground">Ver datos en tabla</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th className="py-1 pr-4 font-medium">Fecha</th>
                {SERIES.map((series) => (
                  <th key={series.key} className="py-1 pr-4 text-right font-medium">
                    {series.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border tabular-nums text-foreground">
              {data.map((row) => (
                <tr key={row.day}>
                  <td className="py-1 pr-4">{formatDay(row.day)}</td>
                  {SERIES.map((series) => (
                    <td key={series.key} className="py-1 pr-4 text-right">
                      {fmt(row[series.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}

function ParticipationPanel({ org }: { org: OrgIndicators | null }) {
  const total = num(org?.comments_7d) ?? 0;
  const tones = [
    { label: "Positivo", count: num(org?.positive_count) ?? 0, className: "bg-brand-emerald" },
    { label: "Neutral", count: num(org?.neutral_count) ?? 0, className: "bg-slate-400" },
    { label: "Negativo", count: num(org?.negative_count) ?? 0, className: "bg-brand-red" },
  ];

  return (
    <>
      <dl className="grid grid-cols-3 gap-3 border-b border-border pb-4">
        <div>
          <dt className="text-xs text-muted-foreground">7 días</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">{total}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">24 horas</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">{num(org?.comments_24h) ?? 0}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Rotación</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">{fmt(num(org?.rotation_risk_score))}</dd>
        </div>
      </dl>

      <p className="mt-4 text-xs font-medium text-muted-foreground">Tono de los comentarios</p>
      {total > 0 ? (
        <>
          <div className="mt-2 flex h-2 gap-0.5 overflow-hidden rounded-full">
            {tones.map((tone) =>
              tone.count > 0 ? (
                <div
                  key={tone.label}
                  className={tone.className}
                  style={{ width: `${(tone.count / total) * 100}%` }}
                  title={`${tone.label}: ${tone.count}`}
                />
              ) : null,
            )}
          </div>
          <ul className="mt-3 space-y-1.5">
            {tones.map((tone) => (
              <li key={tone.label} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className={cn("size-2 rounded-full", tone.className)} />
                  {tone.label}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {tone.count} · {Math.round((tone.count / total) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">Sin comentarios esta semana.</p>
      )}
    </>
  );
}

function DepartmentTable({
  departments,
  columns,
}: {
  departments: DepartmentIndicator[];
  columns: Array<{ label: string; value: (department: DepartmentIndicator) => string }>;
}) {
  if (departments.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Sin datos por área.</p>;
  }

  return (
    <div className="-mx-5 overflow-x-auto px-5">
      <table className="w-full min-w-[36rem] text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th className="py-2 pr-4 text-left font-medium">Área</th>
            <th className="py-2 pr-4 text-right font-medium">Perfiles</th>
            {columns.map((column) => (
              <th key={column.label} className="py-2 pl-4 text-right font-medium">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {departments.map((department) => (
            <tr key={department.department_id} className="transition hover:bg-muted/40">
              <td className="py-2.5 pr-4 font-medium">{department.department_name ?? "Sin área"}</td>
              <td className="py-2.5 pr-4 text-right tabular-nums text-muted-foreground">
                {num(department.members_with_profile) ?? 0}
              </td>
              {department.is_reportable ? (
                columns.map((column) => (
                  <td key={column.label} className="py-2.5 pl-4 text-right tabular-nums">
                    {column.value(department)}
                  </td>
                ))
              ) : (
                <td colSpan={columns.length} className="py-2.5 pl-4 text-right text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Lock className="size-3" />
                    Protegido por anonimato
                  </span>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
