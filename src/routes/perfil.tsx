import { createFileRoute } from "@tanstack/react-router";
import { Mail, Building2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { AppLayout, Card } from "@/components/AppLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { requireAuthAndOnboarded } from "@/lib/auth-guard";
import { supabase } from "@/lib/supabase";
import { getInitials } from "@/lib/utils";
import type { DigitalTwinProfile } from "@/types/assessment";

export const Route = createFileRoute("/perfil")({
  beforeLoad: requireAuthAndOnboarded,
  head: () => ({
    meta: [
      { title: "Mi Perfil · NEXUS LEAD IA" },
      {
        name: "description",
        content: "Tu información de cuenta y tu Gemelo Digital de liderazgo.",
      },
    ],
  }),
  component: () => (
    <ProtectedRoute>
      <ProfilePage />
    </ProtectedRoute>
  ),
});

type UserInfo = { fullName: string | null; email: string | null };

function ProfilePage() {
  const [userInfo, setUserInfo] = useState<UserInfo>({ fullName: null, email: null });
  const [department, setDepartment] = useState<string | null>(null);
  const [profile, setProfile] = useState<DigitalTwinProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      setUserInfo({ fullName: user.user_metadata?.full_name ?? null, email: user.email ?? null });

      const [{ data: myProfile }, { data: twin }] = await Promise.all([
        supabase.from("profiles").select("department_id").eq("user_id", user.id).maybeSingle(),
        supabase.from("digital_twin_profiles").select("*").eq("user_id", user.id).maybeSingle(),
      ]);

      if (myProfile?.department_id) {
        const { data: dept } = await supabase
          .from("departments")
          .select("name")
          .eq("id", myProfile.department_id)
          .maybeSingle();
        setDepartment(dept?.name ?? null);
      }

      setProfile(twin as DigitalTwinProfile | null);
      setLoading(false);
    })();
  }, []);

  const initials = getInitials(userInfo.fullName, userInfo.email);

  return (
    <AppLayout title="Mi Perfil" subtitle="Tu información de cuenta y tu Gemelo Digital">
      <Card className="mb-6">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          <div className="grid size-20 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-blue to-brand-purple text-2xl font-bold text-white">
            {initials}
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-bold">{userInfo.fullName ?? "Sin nombre registrado"}</h2>
            <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-muted-foreground sm:justify-start">
              <Mail className="size-3.5" /> {userInfo.email ?? "—"}
            </p>
            {department && (
              <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-muted-foreground sm:justify-start">
                <Building2 className="size-3.5" /> {department}
              </p>
            )}
          </div>
        </div>
      </Card>

      {loading ? (
        <Card>
          <p className="text-sm text-muted-foreground">Cargando tu Gemelo Digital…</p>
        </Card>
      ) : profile ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Inteligencia Emocional" value={profile.emotional_intelligence_score} />
            <StatCard label="Colaboración" value={profile.collaboration_index} />
            <StatCard label="Resiliencia al Estrés" value={profile.stress_resilience} />
            <StatCard label="Empatía" value={profile.empathy_score} />
          </div>

          <Card className="mt-6">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-brand-purple/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-purple">
              <Sparkles className="size-3" /> Gemelo Digital
            </div>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Estilo de liderazgo</p>
                <p className="mt-1 text-lg font-bold capitalize">{profile.leadership_style}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Modo de conflicto</p>
                <p className="mt-1 text-lg font-bold capitalize">{profile.conflict_mode}</p>
              </div>
            </div>
          </Card>
        </>
      ) : (
        <Card>
          <p className="text-sm text-muted-foreground">Aún no completaste tu Gemelo Digital.</p>
        </Card>
      )}
    </AppLayout>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}/100</p>
    </Card>
  );
}
