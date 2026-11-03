import { AlertCircle, AlertTriangle, CheckCircle2, type LucideIcon } from "lucide-react";

import { Card } from "@/components/AppLayout";
import { fmt, num, type OrgIndicators } from "@/lib/indicators";
import { cn } from "@/lib/utils";

type Status = { label: string; icon: LucideIcon; className: string };

const STATUS = {
  good: { label: "Favorable", icon: CheckCircle2, className: "text-brand-emerald" },
  warning: { label: "Atención", icon: AlertCircle, className: "text-brand-amber" },
  critical: { label: "Crítico", icon: AlertTriangle, className: "text-brand-red" },
} satisfies Record<string, Status>;

// Thresholds on the 0-10 scale; `higherIsBetter` metrics are mirrored.
function statusOf(value: number | null, higherIsBetter: boolean): Status | null {
  if (value === null) return null;
  const risk = higherIsBetter ? 10 - value : value;
  if (risk <= 4) return STATUS.good;
  if (risk <= 6.5) return STATUS.warning;
  return STATUS.critical;
}

export function KpiGrid({ org, loading }: { org: OrgIndicators | null; loading: boolean }) {
  const climate = num(org?.climate_index);
  const stress = num(org?.stress_avg);
  const motivation = num(org?.motivation_avg);
  const burnout = num(org?.burnout_avg);

  const kpis = [
    {
      label: "Índice de clima",
      value: climate === null ? "—" : String(Math.round(climate)),
      scale: "/ 100",
      status: statusOf(climate === null ? null : climate / 10, true),
      hint: "Índice compuesto",
    },
    { label: "Estrés", value: fmt(stress), scale: "/ 10", status: statusOf(stress, false), hint: "Promedio del equipo" },
    {
      label: "Motivación",
      value: fmt(motivation),
      scale: "/ 10",
      status: statusOf(motivation, true),
      hint: "Promedio del equipo",
    },
    {
      label: "Riesgo de burnout",
      value: fmt(burnout),
      scale: "/ 10",
      status: statusOf(burnout, false),
      hint: "Según los comentarios",
    },
  ];

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores principales">
      {kpis.map((kpi) => {
        const StatusIcon = kpi.status?.icon;
        return (
          <Card key={kpi.label} className="p-5">
            <p className="text-sm font-medium text-muted-foreground">{kpi.label}</p>
            <p className="mt-3 flex items-baseline gap-1.5">
              <span className="text-4xl font-semibold tabular-nums tracking-tight">{loading ? "…" : kpi.value}</span>
              <span className="text-sm text-muted-foreground">{kpi.scale}</span>
            </p>
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3 text-xs">
              <span className="truncate text-muted-foreground">{kpi.hint}</span>
              {kpi.status && StatusIcon ? (
                <span className="flex shrink-0 items-center gap-1 font-medium text-foreground">
                  <StatusIcon className={cn("size-3.5", kpi.status.className)} />
                  {kpi.status.label}
                </span>
              ) : (
                <span className="shrink-0 text-muted-foreground">Sin datos</span>
              )}
            </div>
          </Card>
        );
      })}
    </section>
  );
}
