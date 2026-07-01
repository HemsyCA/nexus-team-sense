import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("Procesando autenticación...");

  useEffect(() => {
    let active = true;

    async function finalizeAuth() {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        const error = params.get("error");
        const errorDescription = params.get("error_description");

        if (error) {
          throw new Error(
            errorDescription || "El proveedor Google no está habilitado en Supabase Auth.",
          );
        }

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            throw exchangeError;
          }
        }

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (!session) {
          throw new Error("No se pudo completar la sesión de autenticación.");
        }

        const { data: profile } = await supabase
          .from("digital_twin_profiles")
          .select("user_id")
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (!active) return;

        await navigate({ to: profile ? "/dashboard" : "/onboarding" });
      } catch (error) {
        console.error("Error en callback de OAuth", error);
        if (!active) return;
        const message =
          error instanceof Error && error.message
            ? error.message
            : "No se pudo completar el inicio de sesión con Google.";
        setStatus(message);
        await navigate({ to: "/" });
      }
    }

    void finalizeAuth();

    return () => {
      active = false;
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-bg px-6 text-center text-foreground">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm">
        <p className="text-sm font-semibold text-brand-navy">NEXUS LEAD IA</p>
        <h1 className="mt-3 text-xl font-bold">Finalizando acceso</h1>
        <p className="mt-2 text-sm text-muted-foreground">{status}</p>
      </div>
    </div>
  );
}
