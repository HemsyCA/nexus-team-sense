CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.digital_twin_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  empathy_score NUMERIC(5,2),
  emotional_intelligence_score NUMERIC(5,2),
  stress_resilience NUMERIC(5,2),
  collaboration_index NUMERIC(5,2),
  leadership_style TEXT,
  conflict_mode TEXT,
  raw_scores JSONB,
  onboarding_completed BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.assessment_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  test_name TEXT NOT NULL,
  responses JSONB NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT,
  manager_name TEXT,
  headcount INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.daily_pulse (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  mood TEXT NOT NULL CHECK (mood IN ('good','neutral','bad')),
  energy_level NUMERIC(5,2) NOT NULL,
  stress_level NUMERIC(5,2) NOT NULL,
  motivation_level NUMERIC(5,2) NOT NULL,
  pulse_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, pulse_date)
);

CREATE TABLE IF NOT EXISTS public.daily_feeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  anonymous_code TEXT,
  content TEXT NOT NULL,
  sentiment TEXT NOT NULL DEFAULT 'neutral' CHECK (sentiment IN ('positive','negative','neutral')),
  burnout_score NUMERIC(5,2) DEFAULT 0,
  stress_score NUMERIC(5,2) DEFAULT 0,
  motivation_score NUMERIC(5,2) DEFAULT 0,
  ai_tags JSONB DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.digital_twin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_pulse ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_feeds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own profile" ON public.digital_twin_profiles
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own responses" ON public.assessment_responses
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Authenticated can read departments" ON public.departments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users manage own profile data" ON public.profiles
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own pulse" ON public.daily_pulse
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own feeds" ON public.daily_feeds
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Authenticated can read feed data" ON public.daily_feeds
  FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE VIEW public.org_indicators AS
WITH feed_stats AS (
  SELECT
    AVG(burnout_score) AS burnout_avg,
    AVG(stress_score) AS stress_avg,
    AVG(motivation_score) AS motivation_avg,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') AS comments_24h
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
)
SELECT
  COALESCE(feed_stats.burnout_avg, 0)::NUMERIC(5,2) AS burnout_avg,
  COALESCE(feed_stats.stress_avg, 0)::NUMERIC(5,2) AS stress_avg,
  COALESCE(feed_stats.motivation_avg, 0)::NUMERIC(5,2) AS motivation_avg,
  COALESCE(pulse_stats.energy_avg, 0)::NUMERIC(5,2) AS energy_avg,
  COALESCE(pulse_stats.pulse_stress_avg, 0)::NUMERIC(5,2) AS pulse_stress_avg,
  COALESCE(pulse_stats.pulse_motivation_avg, 0)::NUMERIC(5,2) AS pulse_motivation_avg,
  COALESCE(pulse_stats.users_pulsed_today, 0)::INT AS users_pulsed_today,
  COALESCE(feed_stats.comments_24h, 0)::INT AS comments_24h,
  ROUND(
    (COALESCE(feed_stats.burnout_avg, 0) * 0.5 + COALESCE(pulse_stats.pulse_stress_avg, 0) * 0.3 + (10 - COALESCE(feed_stats.motivation_avg, 0)) * 0.2)::NUMERIC,
    2
  ) AS rotation_risk_score
FROM feed_stats
CROSS JOIN pulse_stats;

CREATE OR REPLACE VIEW public.dept_indicators AS
SELECT
  d.id AS department_id,
  d.name AS department_name,
  d.code AS department_code,
  d.manager_name,
  d.headcount,
  COUNT(DISTINCT p.user_id) AS members_with_profile,
  AVG(df.burnout_score) AS burnout_avg,
  AVG(df.stress_score) AS stress_avg,
  AVG(df.motivation_score) AS motivation_avg,
  AVG(dp.energy_level) AS energy_avg,
  COUNT(df.id) FILTER (WHERE df.sentiment = 'positive') AS positive_count,
  COUNT(df.id) FILTER (WHERE df.sentiment = 'negative') AS negative_count,
  COUNT(df.id) FILTER (WHERE df.sentiment = 'neutral') AS neutral_count,
  ROUND(
    (AVG(df.burnout_score) * 0.5 + AVG(dp.stress_level) * 0.3 + (10 - AVG(df.motivation_score)) * 0.2)::NUMERIC,
    2
  ) AS rotation_risk_score
FROM public.departments d
LEFT JOIN public.profiles p ON p.department_id = d.id
LEFT JOIN public.daily_feeds df ON df.user_id = p.user_id AND df.created_at > NOW() - INTERVAL '7 days'
LEFT JOIN public.daily_pulse dp ON dp.user_id = p.user_id AND dp.pulse_date > CURRENT_DATE - INTERVAL '7 days'
GROUP BY d.id, d.name, d.code, d.manager_name, d.headcount;

CREATE OR REPLACE VIEW public.pulse_trend_14d AS
SELECT
  pulse_date,
  AVG(stress_level) AS stress_avg,
  AVG(motivation_level) AS motivation_avg,
  AVG(energy_level) AS energy_avg,
  COUNT(DISTINCT user_id) AS respondents,
  COUNT(*) FILTER (WHERE mood = 'good') AS mood_good,
  COUNT(*) FILTER (WHERE mood = 'neutral') AS mood_neutral,
  COUNT(*) FILTER (WHERE mood = 'bad') AS mood_bad
FROM public.daily_pulse
WHERE pulse_date > CURRENT_DATE - INTERVAL '14 days'
GROUP BY pulse_date
ORDER BY pulse_date ASC;

CREATE OR REPLACE VIEW public.feed_enriched AS
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
LEFT JOIN public.departments d ON d.id = p.department_id;

GRANT SELECT ON public.org_indicators TO authenticated;
GRANT SELECT ON public.dept_indicators TO authenticated;
GRANT SELECT ON public.pulse_trend_14d TO authenticated;
GRANT SELECT ON public.feed_enriched TO authenticated;

CREATE OR REPLACE FUNCTION public.upsert_daily_pulse(
  p_mood TEXT,
  p_energy NUMERIC,
  p_stress NUMERIC,
  p_motivation NUMERIC
) RETURNS void AS $$
BEGIN
  INSERT INTO public.daily_pulse (user_id, mood, energy_level, stress_level, motivation_level, pulse_date)
  VALUES (auth.uid(), p_mood, p_energy, p_stress, p_motivation, CURRENT_DATE)
  ON CONFLICT (user_id, pulse_date)
  DO UPDATE SET
    mood = EXCLUDED.mood,
    energy_level = EXCLUDED.energy_level,
    stress_level = EXCLUDED.stress_level,
    motivation_level = EXCLUDED.motivation_level;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_active_alerts()
RETURNS TABLE(type TEXT, message TEXT, department TEXT, severity TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT
    'burnout'::TEXT,
    'Alerta crítica de burnout detectada en ' || department_name,
    department_name,
    CASE WHEN burnout_avg > 7 THEN 'critical' ELSE 'high' END
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
    CASE WHEN rotation_risk_score > 7 THEN 'critical' ELSE 'high' END
  FROM public.dept_indicators
  WHERE rotation_risk_score > 7;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
