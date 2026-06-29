import { supabase } from "./supabase";
import type {
  DigitalTwinProfile,
  EQIAssessment,
  MLQAssessment,
  TKIAssessment,
  LeadershipStyle,
  ConflictMode,
} from "@/types/assessment";

const normalize = (value: number, min: number, max: number) =>
  Math.round(((value - min) / (max - min)) * 100);

export function calculateEQIScores(answers: EQIAssessment) {
  const autoconciencia = answers.slice(0, 3).reduce((sum, value) => sum + value, 0);
  const empatia = answers.slice(3, 6).reduce((sum, value) => sum + value, 0);
  const manejo_del_estres = answers.slice(6, 9).reduce((sum, value) => sum + value, 0);
  const motivacion = answers.slice(9, 12).reduce((sum, value) => sum + value, 0);
  const habilidades_sociales = answers.slice(12, 15).reduce((sum, value) => sum + value, 0);
  const promedio_global =
    answers.reduce((sum, value) => sum + value, 0) / answers.length;

  return {
    autoconciencia,
    empatia,
    manejo_del_estres,
    motivacion,
    habilidades_sociales,
    promedio_global,
  };
}

export function calculateMLQScores(answers: MLQAssessment) {
  const transformacional = answers.slice(0, 4).reduce((sum, value) => sum + value, 0);
  const transaccional = answers.slice(4, 8).reduce((sum, value) => sum + value, 0);
  const laissezSum = answers.slice(8, 12).reduce((sum, value) => sum + value, 0);
  const laissez_faire = 16 - laissezSum;

  return { transformacional, transaccional, laissez_faire };
}

export function calculateTKIMode(answers: TKIAssessment): ConflictMode {
  const normalized = answers.map((answer) => answer ?? "A");

  const score = {
    competidor:
      (normalized[1] === "A" ? 1 : 0) +
      (normalized[5] === "B" ? 1 : 0) +
      (normalized[7] === "A" ? 1 : 0) +
      (normalized[8] === "B" ? 1 : 0) +
      (normalized[9] === "A" ? 1 : 0),
    colaborador:
      (normalized[0] === "B" ? 1 : 0) +
      (normalized[2] === "B" ? 1 : 0) +
      (normalized[4] === "A" ? 1 : 0) +
      (normalized[7] === "B" ? 1 : 0),
    comprometido:
      (normalized[1] === "B" ? 1 : 0) +
      (normalized[3] === "A" ? 1 : 0) +
      (normalized[6] === "B" ? 1 : 0) +
      (normalized[9] === "B" ? 1 : 0),
    evitador:
      (normalized[0] === "A" ? 1 : 0) +
      (normalized[4] === "B" ? 1 : 0) +
      (normalized[5] === "A" ? 1 : 0) +
      (normalized[6] === "A" ? 1 : 0) +
      (normalized[8] === "A" ? 1 : 0),
    acomodador:
      (normalized[2] === "A" ? 1 : 0) +
      (normalized[3] === "B" ? 1 : 0),
  };

  const ordered: [ConflictMode, number][] = [
    ["competidor", score.competidor],
    ["colaborador", score.colaborador],
    ["comprometido", score.comprometido],
    ["evitador", score.evitador],
    ["acomodador", score.acomodador],
  ];

  ordered.sort((a, b) => b[1] - a[1]);
  return ordered[0][0];
}

export function getDominantLeadershipStyle(scores: ReturnType<typeof calculateMLQScores>): LeadershipStyle {
  const values = [
    ["transformacional", scores.transformacional],
    ["transaccional", scores.transaccional],
    ["laissez-faire", scores.laissez_faire],
  ] as const;

  values.sort((a, b) => b[1] - a[1]);
  return values[0][0];
}

export function calculateCollaborationIndex(
  empathyScore: number,
  conflictMode: ConflictMode,
) {
  const conflictBonus =
    conflictMode === "colaborador"
      ? 100
      : conflictMode === "acomodador"
      ? 100
      : conflictMode === "comprometido"
      ? 70
      : conflictMode === "competidor"
      ? 40
      : 20;

  return Math.round((empathyScore + conflictBonus) / 2);
}

export async function saveDigitalTwinProfile(
  userId: string,
  eqAnswers: EQIAssessment,
  mlqAnswers: MLQAssessment,
  tkiAnswers: TKIAssessment,
) {
  const eq = calculateEQIScores(eqAnswers);
  const mlq = calculateMLQScores(mlqAnswers);
  const conflict_mode = calculateTKIMode(tkiAnswers);
  const leadership_style = getDominantLeadershipStyle(mlq);

  const empathy_score = normalize(eq.empatia, 3, 15);
  const emotional_intelligence_score = Math.round(((eq.promedio_global - 1) / 4) * 100);
  const stress_resilience = normalize(eq.manejo_del_estres, 3, 15);
  const collaboration_index = calculateCollaborationIndex(empathy_score, conflict_mode);

  const profile: DigitalTwinProfile = {
    user_id: userId,
    empathy_score,
    emotional_intelligence_score,
    leadership_style,
    conflict_mode,
    stress_resilience,
    collaboration_index,
    raw_scores: {
      eq,
      mlq,
      tki: {
        competidor:
          (tkiAnswers[1] === "A" ? 1 : 0) +
          (tkiAnswers[5] === "B" ? 1 : 0) +
          (tkiAnswers[7] === "A" ? 1 : 0) +
          (tkiAnswers[8] === "B" ? 1 : 0) +
          (tkiAnswers[9] === "A" ? 1 : 0),
        colaborador:
          (tkiAnswers[0] === "B" ? 1 : 0) +
          (tkiAnswers[2] === "B" ? 1 : 0) +
          (tkiAnswers[4] === "A" ? 1 : 0) +
          (tkiAnswers[7] === "B" ? 1 : 0),
        comprometido:
          (tkiAnswers[1] === "B" ? 1 : 0) +
          (tkiAnswers[3] === "A" ? 1 : 0) +
          (tkiAnswers[6] === "B" ? 1 : 0) +
          (tkiAnswers[9] === "B" ? 1 : 0),
        evitador:
          (tkiAnswers[0] === "A" ? 1 : 0) +
          (tkiAnswers[4] === "B" ? 1 : 0) +
          (tkiAnswers[5] === "A" ? 1 : 0) +
          (tkiAnswers[6] === "A" ? 1 : 0) +
          (tkiAnswers[8] === "A" ? 1 : 0),
        acomodador:
          (tkiAnswers[2] === "A" ? 1 : 0) +
          (tkiAnswers[3] === "B" ? 1 : 0),
      },
    },
  };

  const { data: profileData, error: profileError } = await supabase
    .from("digital_twin_profiles")
    .upsert({
      user_id: profile.user_id,
      empathy_score: profile.empathy_score,
      emotional_intelligence_score: profile.emotional_intelligence_score,
      leadership_style: profile.leadership_style,
      conflict_mode: profile.conflict_mode,
      stress_resilience: profile.stress_resilience,
      collaboration_index: profile.collaboration_index,
      onboarding_completed: true,
      raw_scores: profile.raw_scores,
    }, { onConflict: "user_id", returning: "representation" })
    .select()
    .single();

  if (profileError) {
    throw new Error(profileError.message);
  }

  const responses = [
    {
      user_id: userId,
      test_name: "eq_i",
      responses: eqAnswers,
    },
    {
      user_id: userId,
      test_name: "mlq",
      responses: mlqAnswers,
    },
    {
      user_id: userId,
      test_name: "tki",
      responses: tkiAnswers,
    },
  ];

  const { error: responsesError } = await supabase.from("assessment_responses").insert(responses);

  if (responsesError) {
    throw new Error(responsesError.message);
  }

  return profileData as DigitalTwinProfile;
}
