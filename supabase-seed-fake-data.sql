-- Datos ficticios para probar el feed y el dashboard
-- Ejecuta este script en Supabase SQL Editor.

-- 1) Departamentos base
INSERT INTO public.departments (id, name, code, manager_name, headcount)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Operaciones', 'OPS', 'Marta Ruiz', 18),
  ('22222222-2222-2222-2222-222222222222', 'Marketing', 'MKT', 'Luis Vega', 12),
  ('33333333-3333-3333-3333-333333333333', 'Ingeniería', 'ENG', 'Ana Torres', 24),
  ('44444444-4444-4444-4444-444444444444', 'RR. HH.', 'HR', 'Clara Díaz', 8)
ON CONFLICT (id) DO NOTHING;

-- 2) Perfiles ficticios vinculados a departamentos
-- Nota: los user_id deben existir en auth.users para que las FK funcionen.
-- Si no existen, puedes dejar solo los inserts en profiles con user_id NULL, pero el feed/dashboard no los usará bien.
INSERT INTO public.profiles (id, user_id, department_id, full_name, avatar_url)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Carlos Méndez', NULL),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Paula Gómez', NULL),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '00000000-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333', 'Javier Ortiz', NULL),
  ('dddddddd-dddd-dddd-dddd-ddddddddddddd', '00000000-0000-0000-0000-000000000004', '44444444-4444-4444-4444-444444444444', 'Sofía Pérez', NULL)
ON CONFLICT (id) DO NOTHING;

-- 3) Perfiles de gemelo digital ficticios para los tests
INSERT INTO public.digital_twin_profiles (
  id, user_id, empathy_score, emotional_intelligence_score, stress_resilience,
  collaboration_index, leadership_style, conflict_mode, raw_scores, onboarding_completed
)
VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 78, 86, 72, 88, 'transformacional', 'colaborador', '{"eq": {"promedio_global": 4.2}, "mlq": {}, "tki": {}}'::jsonb, true),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 74, 81, 68, 83, 'transaccional', 'comprometido', '{"eq": {"promedio_global": 3.9}, "mlq": {}, "tki": {}}'::jsonb, true),
  ('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', 82, 90, 76, 92, 'transformacional', 'colaborador', '{"eq": {"promedio_global": 4.4}, "mlq": {}, "tki": {}}'::jsonb, true),
  ('40000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004', 70, 77, 65, 79, 'laissez-faire', 'acomodador', '{"eq": {"promedio_global": 3.6}, "mlq": {}, "tki": {}}'::jsonb, true)
ON CONFLICT (id) DO NOTHING;

-- 4) Pulsos diarios ficticios
INSERT INTO public.daily_pulse (id, user_id, mood, energy_level, stress_level, motivation_level, pulse_date)
VALUES
  ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'neutral', 6.4, 4.8, 6.2, CURRENT_DATE),
  ('50000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'good', 7.2, 3.2, 7.5, CURRENT_DATE),
  ('50000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', 'bad', 4.8, 6.9, 4.1, CURRENT_DATE),
  ('50000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004', 'neutral', 5.6, 5.1, 5.7, CURRENT_DATE)
ON CONFLICT DO NOTHING;

-- 5) Comentarios ficticios para el feed
INSERT INTO public.daily_feeds (
  id, user_id, anonymous_code, content, sentiment, burnout_score, stress_score, motivation_score, ai_tags, created_at
)
VALUES
  ('60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'COL-101', 'Hoy he sentido más presión por los cambios de última hora.', 'negative', 7.8, 8.1, 2.6, '["sobrecarga","cambio"]'::jsonb, NOW() - INTERVAL '2 hours'),
  ('60000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'COL-102', 'Estoy contento con la colaboración del equipo y el avance del proyecto.', 'positive', 2.4, 3.2, 7.8, '["reconocimiento","trabajo en equipo"]'::jsonb, NOW() - INTERVAL '6 hours'),
  ('60000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', 'COL-103', 'El ritmo sigue siendo alto, pero siento que estoy aprendiendo mucho.', 'neutral', 4.2, 5.3, 6.1, '["aprendizaje"]'::jsonb, NOW() - INTERVAL '10 hours'),
  ('60000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004', 'COL-104', 'Necesitamos más apoyo para gestionar la carga semanal.', 'negative', 6.9, 7.2, 3.4, '["apoyo","carga"]'::jsonb, NOW() - INTERVAL '20 hours')
ON CONFLICT (id) DO NOTHING;
