import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  GitBranch,
  MessagesSquare,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { AppLayout, Card } from "@/components/AppLayout";
import { KpiGrid } from "@/components/KpiGrid";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { requireAuthAndOnboarded } from "@/lib/auth-guard";
import { fmt, num, timeAgo, type AlertItem, type OrgIndicators } from "@/lib/indicators";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

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

type RecentPost = {
  id: string;
  department_name: string | null;
  created_at: string | null;
  content: string;
  sentiment: string | null;
};

type LeadershipProfile = {
  leadership_style: string | null;
  conflict_mode: string | null;
  emotional_intelligence_score: number | null;
  collaboration_index: number | null;
  stress_resilience: number | null;
  empathy_score: number | null;
};

const TONE: Record<string, { label: string; dot: string }> = {
  positive: { label: "Positivo", dot: "bg-brand-emerald" },
  neutral: { label: "Neutral", dot: "bg-slate-400" },
  negative: { label: "Negativo", dot: "bg-brand-red" },
};

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function HomePage() {
  const [org, setOrg] = useState<OrgIndicators | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [posts, setPosts] = useState<RecentPost[]>([]);
  const [profile, setProfile] = useState<LeadershipProfile | null>(null);
  const [greeting, setGreeting] = useState<{ title: string; date: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  async function loadIndicators() {
    const [orgRes, alertRes, feedRes] = await Promise.all([
      supabase.from("org_indicators").select("*").maybeSingle(),
      supabase.rpc("get_active_alerts"),
      supabase
        .from("feed_enriched")
        .select("id, department_name, created_at, content, sentiment")
        .order("created_at", { ascending: false })
        .limit(3),
    ]);

    const firstError = orgRes.error ?? alertRes.error ?? feedRes.error;
    if (firstError) console.error("Error cargando inicio", firstError);
    setError(Boolean(firstError));

    if (!orgRes.error) setOrg((orgRes.data as OrgIndicators | null) ?? null);
    if (!alertRes.error) setAlerts((alertRes.data as AlertItem[] | null) ?? []);
    if (!feedRes.error) setPosts((feedRes.data as RecentPost[] | null) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void loadIndicators();

    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const now = new Date();
      const hour = now.getHours();
      const salutation = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";
      const firstName = (user?.user_metadata?.full_name as string | undefined)?.trim().split(/\s+/)[0];
      setGreeting({
        title: firstName ? `${salutation}, ${firstName}` : salutation,
        date: capitalize(now.toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" })),
      });

      if (!user) return;
      const { data } = await supabase
        .from("digital_twin_profiles")
        .select(
          "leadership_style, conflict_mode, emotional_intelligence_score, collaboration_index, stress_resilience, empathy_score",
        )
        .eq("user_id", user.id)
        .maybeSingle();
      setProfile((data as LeadershipProfile | null) ?? null);
    })();

    const interval = window.setInterval(() => void loadIndicators(), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const alertCount = alerts.length;
  const summary = loading
    ? ""
    : alertCount > 0
      ? `${alertCount} ${alertCount === 1 ? "alerta activa requiere" : "alertas activas requieren"} tu atención.`
      : error
        ? ""
        : "No hay alertas activas por ahora.";

  return (
    <AppLayout title="Inicio" subtitle="Resumen del clima laboral de tu organización">
      <div className="mb-6 min-h-14">
        {greeting ? (
          <>
            <h2 className="text-2xl font-semibold tracking-tight">{greeting.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {greeting.date}
              {summary ? ` · ${summary}` : ""}
            </p>
          </>
        ) : null}
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

      <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Alertas */}
        <Card className="p-5 xl:col-span-7">
          <PanelHeader title="Alertas activas" subtitle="Áreas que superan los umbrales de riesgo" to="/dashboard" link="Ver dashboard" />
          {alerts.length > 0 ? (
            <ul className="divide-y divide-border">
              {alerts.slice(0, 4).map((alert) => {
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

        {/* Perfil de liderazgo */}
        <Card className="p-5 xl:col-span-5">
          <PanelHeader title="Tu perfil de liderazgo" subtitle="Según tu gemelo digital" to="/perfil" link="Ver perfil" />
          {profile ? (
            <>
              <dl className="grid grid-cols-2 gap-3 border-b border-border pb-4">
                <ProfileFact label="Estilo" value={profile.leadership_style} />
                <ProfileFact label="Manejo de conflictos" value={profile.conflict_mode} />
              </dl>
              <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <ProfileScore label="Int. emocional" value={profile.emotional_intelligence_score} />
                <ProfileScore label="Colaboración" value={profile.collaboration_index} />
                <ProfileScore label="Resiliencia" value={profile.stress_resilience} />
                <ProfileScore label="Empatía" value={profile.empathy_score} />
              </dl>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Sin datos de perfil.</p>
          )}
        </Card>

        {/* Últimos comentarios */}
        <Card className="p-5 xl:col-span-7">
          <PanelHeader title="Últimos comentarios" subtitle="Publicados de forma anónima en el feed" to="/feed" link="Ver feed" />
          {posts.length > 0 ? (
            <ul className="divide-y divide-border">
              {posts.map((post) => {
                const tone = TONE[post.sentiment ?? "neutral"] ?? TONE.neutral;
                return (
                  <li key={post.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                      <span className="truncate">
                        {post.department_name ?? "General"} · {timeAgo(post.created_at)}
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        <span className={cn("size-1.5 rounded-full", tone.dot)} />
                        {tone.label}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm leading-relaxed">{post.content}</p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Aún no hay comentarios.</p>
          )}
        </Card>

        {/* Accesos directos */}
        <Card className="p-5 xl:col-span-5">
          <PanelHeader title="Acciones rápidas" subtitle="Continúa con tu trabajo" />
          <nav className="-mx-2 space-y-1">
            <QuickAction to="/chat" icon={Sparkles} title="Conversar con Nexus IA" text="Coaching sobre situaciones de tu equipo" />
            <QuickAction to="/simulaciones" icon={GitBranch} title="Ejecutar una simulación" text="Evalúa el impacto de una decisión" />
            <QuickAction to="/feed" icon={MessagesSquare} title="Publicar en el feed" text="Comparte tu opinión de forma anónima" />
          </nav>
        </Card>
      </section>
    </AppLayout>
  );
}

function PanelHeader({
  title,
  subtitle,
  to,
  link,
}: {
  title: string;
  subtitle: string;
  to?: "/dashboard" | "/perfil" | "/feed";
  link?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      {to ? (
        <Link to={to} className="shrink-0 text-xs font-medium text-brand-navy underline-offset-4 hover:underline">
          {link}
        </Link>
      ) : null}
    </div>
  );
}

function ProfileFact({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 truncate text-sm font-semibold">{value ? capitalize(value) : "—"}</dd>
    </div>
  );
}

function ProfileScore({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="truncate text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{fmt(num(value), 0)}</dd>
    </div>
  );
}

function QuickAction({
  to,
  icon: Icon,
  title,
  text,
}: {
  to: "/chat" | "/simulaciones" | "/feed";
  icon: LucideIcon;
  title: string;
  text: string;
}) {
  return (
    <Link to={to} className="group flex items-center gap-3 rounded-xl p-2 transition hover:bg-muted">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground transition group-hover:bg-card group-hover:text-foreground">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{text}</span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" />
    </Link>
  );
}
