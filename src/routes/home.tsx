import { createFileRoute, Link } from "@tanstack/react-router";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Heart,
  Flame,
  AlertTriangle,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { AppLayout, Card } from "@/components/AppLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { requireAuthAndOnboarded } from "@/lib/auth-guard";

export const Route = createFileRoute("/home")({
  beforeLoad: requireAuthAndOnboarded,
  head: () => ({
    meta: [
      { title: "Inicio · NEXUS LEAD IA" },
      {
        name: "description",
        content: "Resumen del clima laboral, estrés, motivación y riesgo de burnout.",
      },
    ],
  }),
  component: () => (
    <ProtectedRoute>
      <HomePage />
    </ProtectedRoute>
  ),
});

const metrics = [
  {
    label: "Clima Laboral",
    value: "84%",
    trend: "+4% vs mes anterior",
    trendUp: true,
    icon: Heart,
    color: "text-brand-emerald",
    bg: "bg-brand-emerald/10",
  },
  {
    label: "Estrés Promedio",
    value: "Bajo",
    trend: "Nivel 2 de 10",
    trendUp: true,
    icon: Activity,
    color: "text-brand-blue",
    bg: "bg-brand-blue/10",
  },
  {
    label: "Motivación",
    value: "72%",
    trend: "Estable",
    trendUp: true,
    icon: Flame,
    color: "text-brand-purple",
    bg: "bg-brand-purple/10",
  },
  {
    label: "Riesgo Burnout",
    value: "12%",
    trend: "2 alertas activas",
    trendUp: false,
    icon: AlertTriangle,
    color: "text-brand-red",
    bg: "bg-brand-red/10",
  },
];

const alerts = [
  {
    area: "Operaciones",
    text: "Aumento del estrés en los últimos 7 días.",
    level: "Alta",
    levelColor: "bg-brand-red/10 text-brand-red",
  },
  {
    area: "Marketing",
    text: "Disminución de motivación detectada.",
    level: "Media",
    levelColor: "bg-brand-amber/10 text-brand-amber",
  },
  {
    area: "Ingeniería",
    text: "Patrón de fatiga recurrente identificado.",
    level: "Media",
    levelColor: "bg-brand-amber/10 text-brand-amber",
  },
];

function HomePage() {
  return (
    <AppLayout
      title="Dashboard General"
      subtitle="Resumen del clima laboral basado en IA"
    >
      {/* Metrics grid */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <Card key={m.label}>
              <div className="flex items-start justify-between">
                <p className="text-sm text-muted-foreground">{m.label}</p>
                <div className={`grid size-9 place-items-center rounded-lg ${m.bg} ${m.color}`}>
                  <Icon className="size-4" />
                </div>
              </div>
              <h3 className="mt-3 text-3xl font-bold tracking-tight">{m.value}</h3>
              <div
                className={`mt-3 flex items-center gap-1 text-xs font-medium ${
                  m.trendUp ? "text-brand-emerald" : "text-brand-red"
                }`}
              >
                {m.trendUp ? (
                  <TrendingUp className="size-3" />
                ) : (
                  <TrendingDown className="size-3" />
                )}
                {m.trend}
              </div>
            </Card>
          );
        })}
      </section>

      {/* Bottom split */}
      <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Alerts */}
        <Card className="lg:col-span-7">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Alertas Recientes</h2>
              <p className="text-xs text-muted-foreground">
                Detectadas automáticamente por Nexus IA
              </p>
            </div>
            <Link
              to="/dashboard"
              className="text-xs font-semibold text-brand-blue hover:underline"
            >
              Ver dashboard
            </Link>
          </div>
          <ul className="divide-y divide-border">
            {alerts.map((a) => (
              <li key={a.area} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-4 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-sm font-semibold">{a.area}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${a.levelColor}`}>
                      {a.level}
                    </span>
                  </div>
                  <p className="truncate text-sm text-muted-foreground">{a.text}</p>
                </div>
                <button className="grid size-9 shrink-0 place-items-center rounded-full border border-border text-muted-foreground transition hover:border-brand-blue hover:text-brand-blue">
                  <ArrowRight className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </Card>

        {/* Nexus IA CTA */}
        <Card className="overflow-hidden bg-brand-navy text-white lg:col-span-5">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-brand-purple/20 text-brand-purple">
              <Sparkles className="size-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-black">Nexus IA</p>
              <p className="text-[11px] text-brand-blue/100">Coaching predictivo</p>
            </div>
          </div>

          <p className="mt-6 text-sm leading-relaxed text-brand-navy/100">
            Hoy detecté un patrón de fatiga en Operaciones vinculado a las reuniones
            tempranas. ¿Te muestro una simulación de horario alternativo?
          </p>

          <div className="mt-6 flex flex-col gap-2">
            <Link
              to="/chat"
              className="flex items-center justify-between rounded-xl bg-brand-blue px-4 py-3 text-sm font-semibold text-brand-navy transition hover:bg-brand-blue/90"
            >
              Conversar con Nexus IA
              <ArrowRight className="size-4" />
            </Link>
            <Link
              to="/simulaciones"
              className="flex items-center justify-between rounded-xl bg-brand-blue px-4 py-3 text-sm font-semibold text-brand-navy transition hover:bg-brand-blue/90"
            >
              Ejecutar simulación
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </Card>
      </section>
    </AppLayout>
  );
}
