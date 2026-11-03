-- Pestaña "Reuniones": guarda la transcripción y el análisis (nunca el audio).
-- Ejecutar en el SQL Editor de Supabase. Es idempotente: se puede volver a ejecutar.
--
-- Privacidad: cada usuario solo puede ver, crear o borrar sus propias reuniones.

CREATE TABLE IF NOT EXISTS public.meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  duration_seconds INT,
  transcript TEXT NOT NULL,
  voice JSONB,
  analysis JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own meetings" ON public.meetings;
DROP POLICY IF EXISTS "Users add own meetings" ON public.meetings;
DROP POLICY IF EXISTS "Users remove own meetings" ON public.meetings;

CREATE POLICY "Users read own meetings" ON public.meetings
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users add own meetings" ON public.meetings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users remove own meetings" ON public.meetings
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

REVOKE ALL ON public.meetings FROM anon;
GRANT SELECT, INSERT, DELETE ON public.meetings TO authenticated;

NOTIFY pgrst, 'reload schema';
