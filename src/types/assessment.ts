export type EQIAssessment = number[];
export type MLQAssessment = number[];
export type TKIAssessment = Array<"A" | "B" | null>;

export type LeadershipStyle = "transformacional" | "transaccional" | "laissez-faire";
export type ConflictMode =
  | "competidor"
  | "colaborador"
  | "comprometido"
  | "evitador"
  | "acomodador";

export type DigitalTwinProfile = {
  id?: string;
  user_id?: string;
  empathy_score: number;
  emotional_intelligence_score: number;
  leadership_style: LeadershipStyle;
  conflict_mode: ConflictMode;
  stress_resilience: number;
  collaboration_index: number;
  created_at?: string;
  updated_at?: string;
  raw_scores: {
    eq: {
      autoconciencia: number;
      empatia: number;
      manejo_del_estres: number;
      motivacion: number;
      habilidades_sociales: number;
      promedio_global: number;
    };
    mlq: {
      transformacional: number;
      transaccional: number;
      laissez_faire: number;
    };
    tki: {
      competidor: number;
      colaborador: number;
      comprometido: number;
      evitador: number;
      acomodador: number;
    };
  };
};
