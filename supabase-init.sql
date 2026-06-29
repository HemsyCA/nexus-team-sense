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

ALTER TABLE public.digital_twin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own profile" ON public.digital_twin_profiles
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own responses" ON public.assessment_responses
  FOR ALL USING (auth.uid() = user_id);
