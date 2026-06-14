import { createFileRoute, Link } from "@tanstack/react-router";
import { Lock, Mail, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/")({
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
  return (
    <div className="relative grid min-h-screen bg-brand-navy text-white lg:grid-cols-2">
      {/* Left brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden p-12 lg:flex">
        <div
          className="pointer-events-none absolute -left-32 top-1/2 size-[600px] -translate-y-1/2 rounded-full opacity-30 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, var(--brand-blue) 0%, transparent 70%)",
          }}
        />
        <div
          className="pointer-events-none absolute -right-20 -top-20 size-[400px] rounded-full opacity-20 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, var(--brand-purple) 0%, transparent 70%)",
          }}
        />

        <div className="relative flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-xl bg-brand-blue font-bold text-brand-navy shadow-lg shadow-brand-blue/30">
            N
          </div>
          <div className="leading-tight">
            <div className="text-lg font-bold tracking-tight">NEXUS LEAD</div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.25em] text-brand-blue">
              Inteligencia Artificial
            </div>
          </div>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-4xl font-bold leading-tight tracking-tight">
            Escucha a tu equipo antes de que el problema sea visible.
          </h2>
          <p className="mt-6 text-sm leading-relaxed text-white/60">
            Mide clima laboral, estrés, motivación y riesgo de burnout en tiempo
            real. Comentarios diarios anónimos analizados por IA, coaching
            predictivo para líderes.
          </p>

          <div className="mt-10 grid grid-cols-3 gap-4">
            {[
              { v: "100%", l: "Anónimo" },
              { v: "24/7", l: "IA Activa" },
              { v: "AES-256", l: "Cifrado" },
            ].map((s) => (
              <div
                key={s.l}
                className="rounded-xl border border-white/10 bg-white/5 p-4"
              >
                <div className="text-xl font-bold text-brand-blue">{s.v}</div>
                <div className="mt-1 text-[10px] font-medium uppercase tracking-wider text-white/50">
                  {s.l}
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative flex items-center gap-2 text-xs text-white/40">
          <ShieldCheck className="size-3.5" />
          Tus respuestas se procesan de forma anónima y segura.
        </p>
      </div>

      {/* Right form */}
      <div className="flex items-center justify-center bg-brand-bg p-6 text-foreground sm:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-10 flex items-center gap-2 lg:hidden">
            <div className="grid size-9 place-items-center rounded-xl bg-brand-navy font-bold text-brand-blue">
              N
            </div>
            <span className="font-bold tracking-tight">NEXUS LEAD IA</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight">Bienvenido</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Accede con tu cuenta corporativa para continuar.
          </p>

          <form
            className="mt-8 space-y-4"
            onSubmit={(e) => e.preventDefault()}
          >
            <Field icon={<Mail className="size-4" />} label="Correo corporativo">
              <input
                type="email"
                placeholder="nombre@empresa.com"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </Field>
            <Field icon={<Lock className="size-4" />} label="Contraseña">
              <input
                type="password"
                placeholder="••••••••"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </Field>

            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 text-muted-foreground">
                <input type="checkbox" className="accent-brand-blue" />
                Recordar sesión
              </label>
              <a className="font-medium text-brand-navy hover:text-brand-blue" href="#">
                ¿Olvidaste tu contraseña?
              </a>
            </div>

            <Link
              to="/home"
              className="block w-full rounded-xl bg-brand-navy py-3.5 text-center text-sm font-semibold text-white shadow-lg shadow-brand-navy/20 transition hover:bg-brand-navy/90"
            >
              Ingresar
            </Link>

            <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              o
              <span className="h-px flex-1 bg-border" />
            </div>

            <button
              type="button"
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-card py-3 text-sm font-medium transition hover:bg-muted"
            >
              <GoogleIcon />
              Continuar con Google
            </button>
          </form>

          <p className="mt-8 rounded-xl bg-muted/60 p-3 text-center text-[11px] leading-relaxed text-muted-foreground">
            <ShieldCheck className="mr-1 inline size-3 text-brand-emerald" />
            Tus respuestas se procesan de forma{" "}
            <strong className="text-foreground">anónima y segura</strong>.
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block rounded-xl border border-border bg-card px-4 py-2.5 transition focus-within:border-brand-blue focus-within:ring-2 focus-within:ring-brand-blue/15">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 flex items-center gap-2 text-muted-foreground">
        {icon}
        {children}
      </div>
    </label>
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
