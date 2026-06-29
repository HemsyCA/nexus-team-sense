import { useEffect, useState } from "react";
import { BrainCircuit, Sparkles } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/lib/supabase";
import type { DigitalTwinProfile } from "@/types/assessment";

export function DigitalTwinReady() {
  const [profile, setProfile] = useState<DigitalTwinProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchProfile() {
      setLoading(true);
      setError(null);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const userId = session?.user.id;
      if (!userId) {
        setError("No se encontró sesión de usuario.");
        setLoading(false);
        return;
      }

      const { data, error: profileError } = await supabase
        .from<DigitalTwinProfile>("digital_twin_profiles")
        .select("*, raw_scores")
        .eq("user_id", userId)
        .single();

      if (profileError) {
        setError(profileError.message);
      } else {
        setProfile(data);
      }
      setLoading(false);
    }

    void fetchProfile();
  }, []);

  if (loading) {
    return (
      <div className="rounded-3xl border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">Cargando tu gemelo digital…</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="rounded-3xl border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">No se pudo cargar el perfil.</p>
        {error ? <p className="mt-3 text-sm text-brand-red">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-16">
      <div className="rounded-[2rem] border border-border bg-brand-navy/5 p-8 text-center">
        <div className="mx-auto mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-brand-blue/10 text-brand-blue">
          <BrainCircuit className="size-10" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">✅ Tu Gemelo Digital ha sido elaborado</h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
          NEXUS LEAD IA ha construido tu perfil de liderazgo. Ahora puedes simular escenarios, anticipar el impacto de tus decisiones y recibir coaching personalizado.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-border bg-card p-6">
          <p className="text-sm font-semibold text-muted-foreground">Inteligencia Emocional</p>
          <p className="mt-3 text-3xl font-bold text-foreground">{profile.emotional_intelligence_score}/100</p>
          <Progress value={profile.emotional_intelligence_score} className="mt-4" />
        </div>
        <div className="rounded-3xl border border-border bg-card p-6">
          <p className="text-sm font-semibold text-muted-foreground">Índice de Colaboración</p>
          <p className="mt-3 text-3xl font-bold text-foreground">{profile.collaboration_index}/100</p>
          <Progress value={profile.collaboration_index} className="mt-4" />
        </div>
        <div className="rounded-3xl border border-border bg-card p-6">
          <p className="text-sm font-semibold text-muted-foreground">Estilo dominante</p>
          <p className="mt-5 text-2xl font-bold text-foreground capitalize">{profile.leadership_style}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Button onClick={() => void navigate({ to: "/dashboard" })} className="w-full">
          Consultar con Nexus Lead IA →
        </Button>
        <Button variant="secondary" onClick={() => void navigate({ to: "/chat" })} className="w-full">
          Ir al chat de IA
        </Button>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Consulta con Nexus Lead IA para más información y simulaciones organizacionales.
      </p>
    </div>
  );
}
