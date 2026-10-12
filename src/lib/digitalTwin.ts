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

// Each TKI item pairs two conflict modes: answering "A" or "B" scores one of them.
const TKI_KEY: Record<ConflictMode, Array<[index: number, answer: "A" | "B"]>> = {
  competidor: [[1, "A"], [5, "B"], [7, "A"], [8, "B"], [9, "A"]],
  colaborador: [[0, "B"], [2, "B"], [4, "A"], [7, "B"]],
  comprometido: [[1, "B"], [3, "A"], [6, "B"], [9, "B"]],
  evitador: [[0, "A"], [4, "B"], [5, "A"], [6, "A"], [8, "A"]],
  acomodador: [[2, "A"], [3, "B"]],
};

export function calculateTKIScores(answers: TKIAssessment): Record<ConflictMode, number> {
  const normalized = answers.map((answer) => answer ?? "A");
  const score = (mode: ConflictMode) =>
    TKI_KEY[mode].filter(([index, answer]) => normalized[index] === answer).length;

  return {
    competidor: score("competidor"),
    colaborador: score("colaborador"),
    comprometido: score("comprometido"),
    evitador: score("evitador"),
    acomodador: score("acomodador"),
  };
}

export function calculateTKIMode(answers: TKIAssessment): ConflictMode {
  const scores = calculateTKIScores(answers);
  const ordered = Object.entries(scores) as [ConflictMode, number][];

  ordered.sort((a, b) => b[1] - a[1]);
  return ordered[0][0];
}

export function getDominantLeadershipStyle(scores: ReturnType<typeof calculateMLQScores>): LeadershipStyle {
  const values: [LeadershipStyle, number][] = [
    ["transformacional", scores.transformacional],
    ["transaccional", scores.transaccional],
    ["laissez-faire", scores.laissez_faire],
  ];

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
      tki: calculateTKIScores(tkiAnswers),
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
    }, { onConflict: "user_id" })
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
