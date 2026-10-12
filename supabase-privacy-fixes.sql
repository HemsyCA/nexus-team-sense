-- Correcciones de privacidad y seguridad. Ejecutar en el SQL Editor de Supabase
-- DESPUÉS de supabase-init.sql. Es idempotente: se puede volver a ejecutar.

-- 1) Anonimato del feed --------------------------------------------------------
-- La política "Authenticated can read feed data" (USING true) permitía a
-- cualquier usuario leer daily_feeds.user_id, es decir, saber quién escribió
-- cada comentario (también vía Realtime). Ahora cada usuario solo lee sus
-- propias filas; el feed público se lee desde la vista feed_enriched, que no
-- expone user_id.
DROP POLICY IF EXISTS "Authenticated can read feed data" ON public.daily_feeds;

-- 2) Indicadores por departamento ------------------------------------------------
-- Antes: el JOIN simultáneo de feeds y pulsos multiplicaba filas (conteos y
-- promedios inflados) y no incluía los promedios del gemelo digital, por lo que
-- el dashboard los calculaba en el cliente (y RLS solo le dejaba ver los propios).
-- Ahora cada fuente se agrega por separado y las métricas se ocultan si el
-- departamento tiene menos de 3 personas con perfil (evita identificar a alguien).
DROP VIEW IF EXISTS public.dept_indicators;

CREATE VIEW public.dept_indicators AS
WITH members AS (
  SELECT department_id, user_id FROM public.profiles WHERE department_id IS NOT NULL
),
feeds AS (
  SELECT
    m.department_id,
    AVG(df.burnout_score) AS burnout_avg,
    AVG(df.stress_score) AS stress_avg,
    AVG(df.motivation_score) AS motivation_avg,
    COUNT(*) FILTER (WHERE df.sentiment = 'positive') AS positive_count,
    COUNT(*) FILTER (WHERE df.sentiment = 'negative') AS negative_count,
    COUNT(*) FILTER (WHERE df.sentiment = 'neutral') AS neutral_count,
    COUNT(*) AS feed_comments_count
  FROM members m
  JOIN public.daily_feeds df ON df.user_id = m.user_id
  WHERE df.created_at > NOW() - INTERVAL '7 days'
  GROUP BY m.department_id
),
pulses AS (
  SELECT
    m.department_id,
    AVG(dp.energy_level) AS energy_avg,
    AVG(dp.stress_level) AS pulse_stress_avg
  FROM members m
  JOIN public.daily_pulse dp ON dp.user_id = m.user_id
  WHERE dp.pulse_date > CURRENT_DATE - INTERVAL '7 days'
  GROUP BY m.department_id
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
    d.manager_name,
    d.headcount,
    COALESCE(tw.members_with_profile, 0) AS members_with_profile,
    COALESCE(tw.members_with_profile, 0) >= 3 AS is_reportable,
    f.burnout_avg, f.stress_avg, f.motivation_avg,
    f.positive_count, f.negative_count, f.neutral_count, f.feed_comments_count,
    p.energy_avg, p.pulse_stress_avg,
    tw.average_emotional_intelligence, tw.average_collaboration,
    tw.average_stress_resilience, tw.average_empathy
  FROM public.departments d
  LEFT JOIN feeds f ON f.department_id = d.id
  LEFT JOIN pulses p ON p.department_id = d.id
  LEFT JOIN twins tw ON tw.department_id = d.id
)
SELECT
  department_id,
  department_name,
  department_code,
  manager_name,
  headcount,
  members_with_profile,
  is_reportable,
  CASE WHEN is_reportable THEN burnout_avg::NUMERIC(5,2) END AS burnout_avg,
  CASE WHEN is_reportable THEN stress_avg::NUMERIC(5,2) END AS stress_avg,
  CASE WHEN is_reportable THEN motivation_avg::NUMERIC(5,2) END AS motivation_avg,
  CASE WHEN is_reportable THEN energy_avg::NUMERIC(5,2) END AS energy_avg,
  CASE WHEN is_reportable THEN COALESCE(positive_count, 0) END AS positive_count,
  CASE WHEN is_reportable THEN COALESCE(negative_count, 0) END AS negative_count,
  CASE WHEN is_reportable THEN COALESCE(neutral_count, 0) END AS neutral_count,
  CASE WHEN is_reportable THEN COALESCE(feed_comments_count, 0) END AS feed_comments_count,
  CASE WHEN is_reportable THEN average_emotional_intelligence::NUMERIC(5,2) END AS average_emotional_intelligence,
  CASE WHEN is_reportable THEN average_collaboration::NUMERIC(5,2) END AS average_collaboration,
  CASE WHEN is_reportable THEN average_stress_resilience::NUMERIC(5,2) END AS average_stress_resilience,
  CASE WHEN is_reportable THEN average_empathy::NUMERIC(5,2) END AS average_empathy,
  CASE WHEN is_reportable THEN ROUND(
    (COALESCE(burnout_avg, 0) * 0.5 + COALESCE(pulse_stress_avg, 0) * 0.3 + (10 - COALESCE(motivation_avg, 10)) * 0.2)::NUMERIC,
    2
  ) END AS rotation_risk_score
FROM joined;

-- 3) Las vistas agregadas son solo para usuarios autenticados --------------------
-- Supabase concede por defecto privilegios a "anon" sobre objetos nuevos en
-- public, así que sin esto cualquiera con la anon key (pública) podía leerlas.
REVOKE ALL ON public.org_indicators, public.dept_indicators, public.pulse_trend_14d, public.feed_enriched FROM anon;
GRANT SELECT ON public.org_indicators, public.dept_indicators, public.pulse_trend_14d, public.feed_enriched TO authenticated;

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
    motivation_level = EXCLUDED.motivation_level,
    updated_at = now();
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
    'Alerta crítica de burnout detectada en ' || department_name,
    department_name,
    CASE WHEN burnout_avg > 8.5 THEN 'critical' ELSE 'high' END
  FROM public.dept_indicators
  WHERE burnout_avg > 7
  UNION ALL
  SELECT
    'motivation'::TEXT,
    'Motivación crítica en ' || department_name,
    department_name,
    'high'::TEXT
  FROM public.dept_indicators
  WHERE motivation_avg < 4
  UNION ALL
  SELECT
    'rotation'::TEXT,
    'Alto riesgo de rotación en ' || department_name,
    department_name,
    CASE WHEN rotation_risk_score > 8.5 THEN 'critical' ELSE 'high' END
  FROM public.dept_indicators
  WHERE rotation_risk_score > 7;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.upsert_daily_pulse(TEXT, NUMERIC, NUMERIC, NUMERIC) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_active_alerts() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.upsert_daily_pulse(TEXT, NUMERIC, NUMERIC, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_alerts() TO authenticated;
