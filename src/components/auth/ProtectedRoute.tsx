import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";

import { useOnboardingStatus } from "@/hooks/useOnboardingStatus";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { status, error } = useOnboardingStatus();

  useEffect(() => {
    if (status === "unauthenticated") {
      void navigate({ to: "/" });
      return;
    }

    if (status === "pending") {
      void navigate({ to: "/onboarding" });
      return;
    }
  }, [navigate, status]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8 text-center text-sm text-muted-foreground">
        Cargando tu sesión…
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8 text-center">
        <div className="rounded-3xl border border-border bg-card p-6 text-sm text-foreground">
          <p className="font-semibold">Error de autenticación</p>
          <p className="mt-2 text-sm text-muted-foreground">{error ?? "No se pudo verificar tu estado de onboarding."}</p>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated" || status === "pending") {
    return null;
  }

  return <>{children}</>;
}
