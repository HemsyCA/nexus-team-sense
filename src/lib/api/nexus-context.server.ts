import type { SupabaseClient } from "@supabase/supabase-js";

// Server-only prompt building. The system prompt is assembled here from data
// read as the calling user — never accepted from the client — so the Cerebras
// key cannot be used as a general-purpose LLM proxy.

export const NEXUS_SYSTEM_PROMPT = `Eres Nexus IA, asistente
especializado en clima laboral, bienestar organizacional y liderazgo.
Analizas datos de equipos y das recomendaciones a líderes sobre
motivación, burnout, estrés y comunicación.
Eres profesional, empático y directo. Respondes siempre en español.`;

type TwinProfile = {
  emotional_intelligence_score: number | null;
  collaboration_index: number | null;
  stress_resilience: number | null;
  empathy_score: number | null;
  leadership_style: string | null;
  conflict_mode: string | null;
};

type OrgIndicators = {
  burnout_avg: number | null;
  stress_avg: number | null;
  motivation_avg: number | null;
  energy_avg: number | null;
  users_pulsed_today: number | null;
  comments_24h: number | null;
  rotation_risk_score: number | null;
};

export async function getUserProfile(client: SupabaseClient, userId: string) {
  const { data } = await client
    .from("digital_twin_profiles")
    .select(
      "emotional_intelligence_score, collaboration_index, stress_resilience, empathy_score, leadership_style, conflict_mode",
    )
    .eq("user_id", userId)
    .maybeSingle();
  return (data as TwinProfile | null) ?? null;
}

// org_indicators is an aggregate view, so it reflects the whole organisation
// even though RLS only lets the user read their own rows in the base tables.
async function getOrgIndicators(client: SupabaseClient) {
  const { data } = await client.from("org_indicators").select("*").maybeSingle();
  return (data as OrgIndicators | null) ?? null;
}

const fmt = (value: number | null | undefined) =>
  value === null || value === undefined ? "N/A" : String(Math.round(Number(value) * 10) / 10);

export function describeProfile(profile: TwinProfile) {
  return `- Inteligencia Emocional: ${fmt(profile.emotional_intelligence_score)}/100
- Colaboración: ${fmt(profile.collaboration_index)}/100
- Resiliencia al Estrés: ${fmt(profile.stress_resilience)}/100
- Empatía: ${fmt(profile.empathy_score)}/100
- Estilo de Liderazgo: ${profile.leadership_style ?? "N/A"}
- Modo de Conflicto: ${profile.conflict_mode ?? "N/A"}`;
}

export async function buildContextualPrompt(client: SupabaseClient, userId: string) {
  const [profile, org] = await Promise.all([
    getUserProfile(client, userId),
    getOrgIndicators(client),
  ]);

  let prompt = NEXUS_SYSTEM_PROMPT;
  if (profile) {
    prompt += `\n\nPERFIL DEL USUARIO:\n${describeProfile(profile)}
Usa estos datos para personalizar todas tus respuestas.`;
  }
  if (org) {
    prompt += `\n\nINDICADORES DE LA ORGANIZACIÓN (últimos 7 días, escala 0-10):
- Burnout promedio: ${fmt(org.burnout_avg)}
- Estrés promedio: ${fmt(org.stress_avg)}
- Motivación promedio: ${fmt(org.motivation_avg)}
- Energía promedio: ${fmt(org.energy_avg)}
- Riesgo de rotación: ${fmt(org.rotation_risk_score)}
- Personas que registraron su pulso hoy: ${org.users_pulsed_today ?? 0}
- Comentarios en las últimas 24h: ${org.comments_24h ?? 0}`;
  }
  return prompt;
}
