import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { MailCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/verify-email")({
  head: () => ({
    meta: [
      { title: "Verifica tu correo · NEXUS LEAD IA" },
      {
        name: "description",
        content:
          "Verifica tu correo para activar el acceso a Nexus Lead IA y continuar con la creación de tu Gemelo Digital.",
      },
    ],
  }),
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const storedEmail = params.get("email") ?? "";
    setEmail(storedEmail);
  }, []);

  async function handleResend() {
    if (!email) {
      setError("No se encontró el correo para reenviar la confirmación.");
      return;
    }

    setError(null);
    setMessage(null);
    setLoading(true);

    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email,
    });

    setLoading(false);

    if (resendError) {
      setError(resendError.message);
      return;
    }

    setMessage("Correo de confirmación reenviado. Revisa tu bandeja de entrada.");
  }

  return (
    <div className="grid min-h-screen place-items-center bg-brand-bg px-6 py-12 text-foreground">
      <div className="w-full max-w-xl space-y-8">
        <div className="rounded-[2rem] border border-border bg-card p-10 text-center shadow-lg shadow-slate-900/5">
          <div className="mx-auto mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-brand-blue/10 text-brand-blue">
            <MailCheck className="size-10" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Revisa tu correo</h1>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">
            Te enviamos un enlace de confirmación a <strong>{email || "tu correo"}</strong>. Confirma tu cuenta para activar tu acceso a Nexus Lead IA y comenzar a construir tu Gemelo Digital.
          </p>
          <p className="mt-4 text-xs text-muted-foreground">
            Tus datos son almacenados de forma segura en Supabase con cifrado AES-256.
          </p>

          {message ? (
            <div className="mt-6 rounded-3xl border border-emerald-300/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700">
              {message}
            </div>
          ) : null}

          {error ? (
            <div className="mt-6 rounded-3xl border border-brand-red/20 bg-brand-red/10 px-4 py-3 text-sm text-brand-red">
              {error}
            </div>
          ) : null}

          <div className="mt-8 grid gap-3 sm:grid-cols-[1fr_auto]">
            <Button onClick={handleResend} disabled={loading} className="w-full">
              {loading ? "Reenviando…" : "Reenviar correo"}
            </Button>
            <Button variant="secondary" onClick={() => navigate({ to: "/" })} className="w-full sm:w-auto">
              Iniciar sesión →
            </Button>
          </div>

          <p className="mt-6 text-sm text-muted-foreground">
            ¿Ya confirmaste?{' '}
            <Link to="/" className="font-semibold text-brand-blue hover:underline">
              Inicia sesión →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
