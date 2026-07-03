import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Mail, Lock, User } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { redirectIfAuthenticated } from "@/lib/auth-guard";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/register")({
  beforeLoad: redirectIfAuthenticated,
  head: () => ({
    meta: [
      { title: "Registro · NEXUS LEAD IA" },
      {
        name: "description",
        content: "Regístrate para crear tu Gemelo Digital y acceder a Nexus Lead IA.",
      },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await supabase.auth.signUp(
        { email, password },
        {
          data: { full_name: name },
          emailRedirectTo: `${window.location.origin}/onboarding`,
        },
      );

      setLoading(false);

      const { data, error } = res as any;

      if (error) {
        console.error("Registro error (supabase):", error, res);
        const extract = (e: any) => {
          if (!e) return null;
          if (typeof e === "string") return e;
          if (e.message) return e.message;
          if (e.error_description) return e.error_description;
          if (e.msg) return e.msg;
          if (e.hint) return e.hint;
          return null;
        };
        const message = extract(error) ?? (Object.keys(error).length ? JSON.stringify(error) : null) ?? "Ocurrió un error al crear la cuenta. Revisa la consola para más detalles.";
        setError(message);
        return;
      }

      if (data?.session) {
        await navigate({ to: "/onboarding" });
        return;
      }

      await navigate({ to: `/verify-email?email=${encodeURIComponent(email)}` });
    } catch (err) {
      console.error("Registro error (throw):", err);
      setLoading(false);
      const message = err instanceof Error ? err.message : (err && Object.keys(err).length ? JSON.stringify(err) : "Ocurrió un error al crear la cuenta. Revisa la consola para más detalles.");
      setError(message as string);
    }
  }

  return (
    <div className="relative grid min-h-screen bg-brand-navy text-white lg:grid-cols-2">
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
            Crea tu Gemelo Digital
          </h2>
          <p className="mt-6 text-sm leading-relaxed text-white/60">
            Responde los tests psicométricos y construye tu perfil de liderazgo para recibir coaching predictivo.
          </p>

          <div className="mt-10 grid grid-cols-3 gap-4">
            {[
              { v: "3 tests", l: "Rápido" },
              { v: "100%", l: "Seguro" },
              { v: "IA", l: "Personalizado" },
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
          <Lock className="size-3.5" />
          Protegemos tus datos con cifrado y seudonimización.
        </p>
      </div>

      <div className="flex items-center justify-center bg-brand-bg p-6 text-foreground sm:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-10 flex items-center gap-2 lg:hidden">
            <div className="grid size-9 place-items-center rounded-xl bg-brand-navy font-bold text-brand-blue">
              N
            </div>
            <span className="font-bold tracking-tight">NEXUS LEAD IA</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight">Crear cuenta</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Regístrate para iniciar el onboarding y crear tu Gemelo Digital.
          </p>

          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            <Field icon={<User className="size-4" />} label="Nombre completo">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tu nombre"
                required
                className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </Field>
            <Field icon={<Mail className="size-4" />} label="Correo corporativo">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nombre@empresa.com"
                required
                autoComplete="email"
                className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </Field>
            <Field icon={<Lock className="size-4" />} label="Contraseña">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="new-password"
                className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </Field>

            {error && (
              <p className="rounded-lg border border-brand-red/30 bg-brand-red/5 px-3 py-2 text-xs text-brand-red">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full">
              {loading ? "Creando cuenta…" : "Comenzar — Crear mi Gemelo Digital"}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              ¿Ya tienes cuenta?{' '}
              <Link to="/" className="text-brand-blue hover:underline">
                Inicia sesión
              </Link>
            </p>
          </form>
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
      <div className="mt-1 flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        {children}
      </div>
    </label>
  );
}
