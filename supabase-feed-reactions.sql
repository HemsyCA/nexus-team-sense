-- Reacciones del feed ("Apoyo" / "Me identifico"). Ejecutar en el SQL Editor
-- de Supabase. Es idempotente: se puede volver a ejecutar.
--
-- Privacidad: cada usuario solo puede leer, crear o borrar SUS reacciones.
-- Los demás solo ven los totales a través de la vista feed_reaction_counts.

CREATE TABLE IF NOT EXISTS public.feed_reactions (
  feed_id UUID NOT NULL REFERENCES public.daily_feeds(id) ON DELETE CASCADE,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction TEXT NOT NULL CHECK (reaction IN ('support', 'relate')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (feed_id, user_id, reaction)
);

ALTER TABLE public.feed_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own reactions" ON public.feed_reactions;
DROP POLICY IF EXISTS "Users add own reactions" ON public.feed_reactions;
DROP POLICY IF EXISTS "Users remove own reactions" ON public.feed_reactions;

CREATE POLICY "Users read own reactions" ON public.feed_reactions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users add own reactions" ON public.feed_reactions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users remove own reactions" ON public.feed_reactions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE VIEW public.feed_reaction_counts AS
SELECT feed_id, reaction, COUNT(*)::INT AS votes
FROM public.feed_reactions
GROUP BY feed_id, reaction;

REVOKE ALL ON public.feed_reactions, public.feed_reaction_counts FROM anon;
GRANT SELECT, INSERT, DELETE ON public.feed_reactions TO authenticated;
GRANT SELECT ON public.feed_reaction_counts TO authenticated;
