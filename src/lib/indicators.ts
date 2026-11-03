// Shapes and helpers for the aggregated views created by
// supabase-privacy-fixes.sql, shared by Inicio and the Dashboard.

export type OrgIndicators = {
  climate_index: number | null;
  burnout_avg: number | null;
  stress_avg: number | null;
  motivation_avg: number | null;
  comments_7d: number | null;
  comments_24h: number | null;
  positive_count: number | null;
  neutral_count: number | null;
  negative_count: number | null;
  rotation_risk_score: number | null;
};

export type AlertItem = {
  type: string;
  message: string;
  department: string;
  severity: string;
};

export function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export const fmt = (value: number | null, digits = 1) => (value === null ? "—" : value.toFixed(digits));

export function timeAgo(value: string | null) {
  if (!value) return "ahora";
  const minutes = Math.floor((Date.now() - new Date(value).getTime()) / 60_000);
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return days === 1 ? "ayer" : `hace ${days} días`;
  return new Date(value).toLocaleDateString("es-PE", { day: "numeric", month: "short" });
}
