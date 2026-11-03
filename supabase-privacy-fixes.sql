-- Indicadores del dashboard y correcciones de privacidad.
-- Ejecutar completo en el SQL Editor de Supabase. Es idempotente: se puede
-- volver a ejecutar. No depende de que existan las vistas de supabase-init.sql.

-- 1) Anonimato del feed --------------------------------------------------------
-- La política "Authenticated can read feed data" (USING true) permitía a
-- cualquier usuario leer daily_feeds.user_id, es decir, saber quién escribió
-- cada comentario (también vía Realtime). Ahora cada usuario solo lee sus
-- propias filas; el feed público se lee desde la vista feed_enriched, que no
-- expone user_id.
DO $$
DECLARE
  p RECORD;
BEGIN
  -- Cualquier política de lectura abierta, sea cual sea su nombre.
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'daily_feeds'
      AND cmd IN ('SELECT', 'ALL') AND qual = 'true'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.daily_feeds', p.policyname);
  END LOOP;
END $$;

-- Cada usuario puede publicar y leer sus propios comentarios.
ALTER TABLE public.daily_feeds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users add own feeds" ON public.daily_feeds;
DROP POLICY IF EXISTS "Users read own feeds" ON public.daily_feeds;
CREATE POLICY "Users add own feeds" ON public.daily_feeds
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users read own feeds" ON public.daily_feeds
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
GRANT SELECT, INSERT ON public.daily_feeds TO authenticated;

-- Vista pública del feed: nunca expone user_id y muestra todos los comentarios,
-- aunque el autor no tenga un área asignada.
DROP VIEW IF EXISTS public.feed_enriched;
CREATE VIEW public.feed_enriched AS
SELECT
  df.id,
  df.anonymous_code,
  df.content,
  df.sentiment,
  df.burnout_score,
  df.stress_score,
  df.motivation_score,
  df.ai_tags,
  df.created_at,
  d.name AS department_name,
  d.code AS department_code
FROM public.daily_feeds df
LEFT JOIN public.profiles p ON p.user_id = df.user_id
LEFT JOIN public.departments d ON d.id = COALESCE(df.department_id, p.department_id);

-- 2) Vistas agregadas ------------------------------------------------------------
DROP VIEW IF EXISTS public.org_indicators;
DROP VIEW IF EXISTS public.dept_indicators;
DROP VIEW IF EXISTS public.climate_trend_14d;

-- Indicadores de toda la organización (últimos 7 días). Sin datos devuelven
-- NULL, no 0: "sin datos" no es lo mismo que "burnout cero".
CREATE VIEW public.org_indicators AS
WITH feed_stats AS (
  SELECT
    AVG(burnout_score) AS burnout_avg,
    AVG(stress_score) AS stress_avg,
    AVG(motivation_score) AS motivation_avg,
    COUNT(*) AS comments_7d,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') AS comments_24h,
    COUNT(*) FILTER (WHERE sentiment = 'positive') AS positive_count,
    COUNT(*) FILTER (WHERE sentiment = 'neutral') AS neutral_count,
    COUNT(*) FILTER (WHERE sentiment = 'negative') AS negative_count
  FROM public.daily_feeds
  WHERE created_at > NOW() - INTERVAL '7 days'
), pulse_stats AS (
  SELECT
    AVG(energy_level) AS energy_avg,
    AVG(stress_level) AS pulse_stress_avg,
    AVG(motivation_level) AS pulse_motivation_avg,
    COUNT(DISTINCT user_id) FILTER (WHERE pulse_date = CURRENT_DATE) AS users_pulsed_today
  FROM public.daily_pulse
  WHERE pulse_date > CURRENT_DATE - INTERVAL '7 days'
), merged AS (
  SELECT
    f.*,
    p.*,
    COALESCE(p.pulse_stress_avg, f.stress_avg) AS stress_any,
    COALESCE(p.pulse_motivation_avg, f.motivation_avg) AS motivation_any
  FROM feed_stats f CROSS JOIN pulse_stats p
)
SELECT
  burnout_avg::NUMERIC(5,2) AS burnout_avg,
  stress_any::NUMERIC(5,2) AS stress_avg,
  motivation_any::NUMERIC(5,2) AS motivation_avg,
  energy_avg::NUMERIC(5,2) AS energy_avg,
  COALESCE(users_pulsed_today, 0)::INT AS users_pulsed_today,
  comments_7d::INT AS comments_7d,
  comments_24h::INT AS comments_24h,
  positive_count::INT AS positive_count,
  neutral_count::INT AS neutral_count,
  negative_count::INT AS negative_count,
  -- Índice 0-100: motivación alta, estrés y burnout bajos.
  CASE WHEN burnout_avg IS NOT NULL AND stress_any IS NOT NULL AND motivation_any IS NOT NULL THEN
    ROUND(((motivation_any + (10 - stress_any) + (10 - burnout_avg)) / 3 * 10)::NUMERIC, 0)
  END AS climate_index,
  CASE WHEN burnout_avg IS NOT NULL AND stress_any IS NOT NULL AND motivation_any IS NOT NULL THEN
    ROUND((burnout_avg * 0.5 + stress_any * 0.3 + (10 - motivation_any) * 0.2)::NUMERIC, 2)
  END AS rotation_risk_score
FROM merged;

-- Evolución diaria de los últimos 14 días, a partir de los comentarios.
CREATE VIEW public.climate_trend_14d AS
SELECT
  created_at::DATE AS day,
  AVG(stress_score)::NUMERIC(5,2) AS stress_avg,
  AVG(motivation_score)::NUMERIC(5,2) AS motivation_avg,
  AVG(burnout_score)::NUMERIC(5,2) AS burnout_avg,
  COUNT(*)::INT AS comments
FROM public.daily_feeds
WHERE created_at > NOW() - INTERVAL '14 days'
GROUP BY created_at::DATE
ORDER BY day ASC;

-- Indicadores por departamento. Cada fuente se agrega por separado (un JOIN
-- simultáneo de comentarios y pulsos multiplicaría filas) y las métricas se
-- ocultan si el área tiene menos de 3 personas con perfil, para que no se pueda
-- identificar a nadie.
CREATE VIEW public.dept_indicators AS
WITH members AS (
  SELECT department_id, user_id FROM public.profiles WHERE department_id IS NOT NULL
),
feeds AS (
  SELECT
    COALESCE(df.department_id, p.department_id) AS department_id,
    AVG(df.burnout_score) AS burnout_avg,
    AVG(df.stress_score) AS stress_avg,
    AVG(df.motivation_score) AS motivation_avg,
    COUNT(*) FILTER (WHERE df.sentiment = 'positive') AS positive_count,
    COUNT(*) FILTER (WHERE df.sentiment = 'negative') AS negative_count,
    COUNT(*) FILTER (WHERE df.sentiment = 'neutral') AS neutral_count,
    COUNT(*) AS feed_comments_count
  FROM public.daily_feeds df
  LEFT JOIN public.profiles p ON p.user_id = df.user_id
  WHERE df.created_at > NOW() - INTERVAL '7 days'
  GROUP BY COALESCE(df.department_id, p.department_id)
),
twins AS (
  SELECT
    m.department_id,
    COUNT(*) AS members_with_profile,
    AVG(t.emotional_intelligence_score) AS average_emotional_intelligence,
    AVG(t.collaboration_index) AS average_collaboration,
    AVG(t.stress_resilience) AS average_stress_resilience,
    AVG(t.empathy_score) AS average_empathy
  FROM members m
  JOIN public.digital_twin_profiles t ON t.user_id = m.user_id
  GROUP BY m.department_id
),
joined AS (
  SELECT
    d.id AS department_id,
    d.name AS department_name,
    d.code AS department_code,
    d.headcount,
    COALESCE(tw.members_with_profile, 0) AS members_with_profile,
    COALESCE(tw.members_with_profile, 0) >= 3 AS is_reportable,
    f.burnout_avg, f.stress_avg, f.motivation_avg,
    f.positive_count, f.negative_count, f.neutral_count, f.feed_comments_count,
    tw.average_emotional_intelligence, tw.average_collaboration,
    tw.average_stress_resilience, tw.average_empathy
  FROM public.departments d
  LEFT JOIN feeds f ON f.department_id = d.id
  LEFT JOIN twins tw ON tw.department_id = d.id
)
SELECT
  department_id,
  department_name,
  department_code,
  headcount,
  members_with_profile::INT AS members_with_profile,
  is_reportable,
  CASE WHEN is_reportable THEN burnout_avg::NUMERIC(5,2) END AS burnout_avg,
  CASE WHEN is_reportable THEN stress_avg::NUMERIC(5,2) END AS stress_avg,
  CASE WHEN is_reportable THEN motivation_avg::NUMERIC(5,2) END AS motivation_avg,
  CASE WHEN is_reportable THEN COALESCE(positive_count, 0)::INT END AS positive_count,
  CASE WHEN is_reportable THEN COALESCE(negative_count, 0)::INT END AS negative_count,
  CASE WHEN is_reportable THEN COALESCE(neutral_count, 0)::INT END AS neutral_count,
  CASE WHEN is_reportable THEN COALESCE(feed_comments_count, 0)::INT END AS feed_comments_count,
  CASE WHEN is_reportable THEN average_emotional_intelligence::NUMERIC(5,2) END AS average_emotional_intelligence,
  CASE WHEN is_reportable THEN average_collaboration::NUMERIC(5,2) END AS average_collaboration,
  CASE WHEN is_reportable THEN average_stress_resilience::NUMERIC(5,2) END AS average_stress_resilience,
  CASE WHEN is_reportable THEN average_empathy::NUMERIC(5,2) END AS average_empathy,
  CASE WHEN is_reportable AND burnout_avg IS NOT NULL THEN ROUND(
    (burnout_avg * 0.5 + COALESCE(stress_avg, 0) * 0.3 + (10 - COALESCE(motivation_avg, 10)) * 0.2)::NUMERIC,
    2
  ) END AS rotation_risk_score
FROM joined;

-- 3) Solo usuarios autenticados --------------------------------------------------
-- Supabase concede por defecto privilegios a "anon" sobre objetos nuevos en
-- public, así que sin esto cualquiera con la anon key (que es pública) podía
-- leer los comentarios y los indicadores sin iniciar sesión.
REVOKE ALL ON public.org_indicators, public.dept_indicators, public.climate_trend_14d, public.feed_enriched FROM anon, public;
GRANT SELECT ON public.org_indicators, public.dept_indicators, public.climate_trend_14d, public.feed_enriched TO authenticated;

-- 4) Funciones SECURITY DEFINER endurecidas --------------------------------------
-- search_path fijo (evita secuestro de objetos), sesión obligatoria y rangos válidos.
CREATE OR REPLACE FUNCTION public.upsert_daily_pulse(
  p_mood TEXT,
  p_energy NUMERIC,
  p_stress NUMERIC,
  p_motivation NUMERIC
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;
  IF p_energy NOT BETWEEN 0 AND 10 OR p_stress NOT BETWEEN 0 AND 10 OR p_motivation NOT BETWEEN 0 AND 10 THEN
    RAISE EXCEPTION 'Los valores del pulso deben estar entre 0 y 10';
  END IF;

  INSERT INTO public.daily_pulse (user_id, mood, energy_level, stress_level, motivation_level, pulse_date)
  VALUES (auth.uid(), p_mood, p_energy, p_stress, p_motivation, CURRENT_DATE)
  ON CONFLICT (user_id, pulse_date)
  DO UPDATE SET
    mood = EXCLUDED.mood,
    energy_level = EXCLUDED.energy_level,
    stress_level = EXCLUDED.stress_level,
    motivation_level = EXCLUDED.motivation_level;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_active_alerts()
RETURNS TABLE(type TEXT, message TEXT, department TEXT, severity TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    'burnout'::TEXT,
    'Burnout elevado en ' || di.department_name,
    di.department_name,
    (CASE WHEN di.burnout_avg > 8.5 THEN 'critical' ELSE 'high' END)::TEXT
  FROM public.dept_indicators di
  WHERE di.burnout_avg > 7
  UNION ALL
  SELECT
    'motivation'::TEXT,
    'Motivación baja en ' || di.department_name,
    di.department_name,
    'high'::TEXT
  FROM public.dept_indicators di
  WHERE di.motivation_avg < 4
  UNION ALL
  SELECT
    'rotation'::TEXT,
    'Riesgo de rotación alto en ' || di.department_name,
    di.department_name,
    (CASE WHEN di.rotation_risk_score > 8.5 THEN 'critical' ELSE 'high' END)::TEXT
  FROM public.dept_indicators di
  WHERE di.rotation_risk_score > 7;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.upsert_daily_pulse(TEXT, NUMERIC, NUMERIC, NUMERIC) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_active_alerts() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.upsert_daily_pulse(TEXT, NUMERIC, NUMERIC, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_alerts() TO authenticated;

-- Refresca la caché de PostgREST para que las vistas nuevas estén disponibles al instante.
NOTIFY pgrst, 'reload schema';
