import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { BarChart3, Lock, Mail, ShieldCheck, Users } from "lucide-react";
import { useEffect, useState } from "react";

import { redirectIfAuthenticated } from "@/lib/auth-guard";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/")({
  beforeLoad: redirectIfAuthenticated,
  head: () => ({
    meta: [
      { title: "NEXUS LEAD IA — Acceso" },
      {
        name: "description",
        content:
          "Plataforma de inteligencia artificial para medir clima laboral, estrés y burnout de forma anónima.",
      },
      { property: "og:title", content: "NEXUS LEAD IA" },
      {
        property: "og:description",
        content: "Escucha a tu equipo antes de que el problema sea visible.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);

  useEffect(() => {
    let active = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!active || !session) return;

      const { data: profile } = await supabase
        .from("digital_twin_profiles")
        .select("user_id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      await navigate({ to: profile ? "/dashboard" : "/onboarding" });
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (authError) {
      setError("Correo o contraseña incorrectos. Verifica tus credenciales.");
      return;
    }

    await navigate({ to: "/home" });
  }

  async function handleGoogleSignIn() {
    setError(null);
    setSocialLoading(true);

    const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });

    setSocialLoading(false);

    if (oauthError) {
      setError(oauthError.message);
      return;
    }

    if (data?.url) {
      window.location.assign(data.url);
    }
  }

  async function handleCreateAccount() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) {
      const confirmed = window.confirm(
        `Ya tienes sesión activa como ${session.user.email}.\n\n¿Quieres continuar con esta cuenta?`,
      );
      if (confirmed) {
        void navigate({ to: "/onboarding" });
      }
    } else {
      void navigate({ to: "/register" });
    }
  }

  return (
    <div className="grid min-h-screen bg-brand-bg text-foreground lg:grid-cols-[1.1fr_1fr]">
      {/* Panel institucional */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-brand-navy p-14 text-white lg:flex">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />

        <div className="relative flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-md border border-white/20 bg-white/5 text-sm font-semibold tracking-wider">
            NL
          </div>
          <div className="leading-tight">
            <div className="text-base font-semibold tracking-wide">NEXUS LEAD</div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-white/50">
              Inteligencia Organizacional
            </div>
          </div>
        </div>

        <div className="relative max-w-lg">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-blue">
            Plataforma corporativa
          </p>
          <h2 className="mt-4 text-[2.5rem] font-semibold leading-[1.15] tracking-tight">
            Gestión del clima laboral basada en datos.
          </h2>
          <p className="mt-5 text-[15px] leading-relaxed text-white/65">
            Indicadores de bienestar, motivación y riesgo de rotación para que la dirección y
            los líderes de equipo tomen decisiones informadas.
          </p>

          <ul className="mt-10 space-y-5 border-t border-white/10 pt-8">
            {[
              {
                icon: BarChart3,
                title: "Indicadores en tiempo real",
                text: "Clima, estrés y motivación por área, en un solo tablero.",
              },
              {
                icon: Users,
                title: "Desarrollo de liderazgo",
                text: "Perfil de competencias y recomendaciones personalizadas.",
              },
              {
                icon: ShieldCheck,
                title: "Confidencialidad garantizada",
                text: "Participación anónima y datos agregados por departamento.",
              },
            ].map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <Icon className="mt-0.5 size-5 shrink-0 text-brand-blue" />
                <div>
                  <p className="text-sm font-medium">{title}</p>
                  <p className="mt-1 text-sm text-white/55">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center justify-between text-xs text-white/40">
          <span>© {new Date().getFullYear()} NEXUS LEAD IA</span>
          <span>Uso exclusivo corporativo</span>
        </div>
      </aside>

      {/* Formulario de acceso */}
      <main className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <div className="grid size-9 place-items-center rounded-md bg-brand-navy text-xs font-semibold tracking-wider text-white">
              NL
            </div>
            <span className="font-semibold tracking-wide">NEXUS LEAD IA</span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">Iniciar sesión</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ingrese con su cuenta corporativa para acceder a la plataforma.
          </p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <Field id="email" icon={<Mail className="size-4" />} label="Correo corporativo">
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nombre@empresa.com"
                required
                autoComplete="email"
                className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </Field>
            <Field id="password" icon={<Lock className="size-4" />} label="Contraseña">
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </Field>

            {error && (
              <p
                role="alert"
                className="rounded-md border border-brand-red/30 bg-brand-red/5 px-3 py-2 text-xs text-brand-red"
              >
                {error}
              </p>
            )}

            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 text-muted-foreground">
                <input type="checkbox" className="accent-brand-navy" />
                Mantener sesión iniciada
              </label>
              <a className="font-medium text-brand-navy underline-offset-4 hover:underline" href="#">
                ¿Olvidó su contraseña?
              </a>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="block w-full rounded-md bg-brand-navy py-3 text-center text-sm font-semibold text-white transition hover:bg-brand-navy/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Verificando…" : "Iniciar sesión"}
            </button>

            <div className="flex items-center gap-3 text-[11px] uppercase tracking-wider text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              o continúe con
              <span className="h-px flex-1 bg-border" />
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={socialLoading}
              className="flex w-full items-center justify-center gap-3 rounded-md border border-border bg-card py-3 text-sm font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              <GoogleIcon />
              {socialLoading ? "Redirigiendo…" : "Google"}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            ¿Aún no tiene una cuenta?{" "}
            <button
              type="button"
              onClick={() => void handleCreateAccount()}
              className="font-semibold text-brand-navy underline-offset-4 hover:underline"
            >
              Crear cuenta
            </button>
          </p>

          <p className="mt-10 flex items-start gap-2 border-t border-border pt-6 text-[11px] leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-brand-emerald" />
            La información de los colaboradores se procesa de forma anónima y se presenta
            únicamente en datos agregados.
          </p>
        </div>
      </main>
    </div>
  );
}

function Field({
  id,
  icon,
  label,
  children,
}: {
  id: string;
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-foreground">
        {label}
      </label>
      <div className="flex items-center gap-2 rounded-md border border-input bg-card px-3 py-2.5 transition focus-within:border-brand-navy focus-within:ring-2 focus-within:ring-brand-navy/10">
        <span className="text-muted-foreground">{icon}</span>
        {children}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.6 39.6 16.3 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.2 5.2c-.4.4 6.6-4.8 6.6-14.8 0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
