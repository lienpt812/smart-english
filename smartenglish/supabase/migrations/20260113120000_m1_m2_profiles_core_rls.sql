-- CHỈ CHẠY TRÊN SUPABASE (cần schema auth). Postgres docker-compose local không dùng file này.
-- Áp dụng: Dashboard → SQL Editor, hoặc `supabase db push`.

-- M1 — Profiles + trigger Supabase Auth (Google trong Dashboard).
-- M2 — Schema lõi + RLS; REST = PostgREST + Bearer JWT.

------------------------------------------------------------------------------
-- Types
------------------------------------------------------------------------------
CREATE TYPE public.target_cert AS ENUM ('TOEIC', 'IELTS', 'COMMUNICATION');
CREATE TYPE public.cefr_level AS ENUM ('A1', 'A2', 'B1', 'B2', 'C1', 'C2');
CREATE TYPE public.exercise_skill AS ENUM (
  'listening',
  'speaking',
  'reading',
  'writing'
);
CREATE TYPE public.session_kind AS ENUM (
  'practice',
  'mock_exam',
  'placement',
  'tutor_chat'
);

------------------------------------------------------------------------------
-- M1: profiles (= public user façade; không tạo bảng users trùng với auth.users)
------------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email TEXT,
  avatar_url TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now()),
  level public.cefr_level,
  target_cert public.target_cert,
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_profiles_email ON public.profiles (email);

------------------------------------------------------------------------------
-- M2: decks / cards / srs review log
------------------------------------------------------------------------------
CREATE TABLE public.decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  owner_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now ())
);

CREATE INDEX idx_decks_owner ON public.decks (owner_id);

CREATE TABLE public.cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  deck_id UUID NOT NULL REFERENCES public.decks (id) ON DELETE CASCADE,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  hint TEXT,
  ease_factor DOUBLE PRECISION NOT NULL DEFAULT 2.5,
  interval_days INTEGER NOT NULL DEFAULT 0,
  repetitions INTEGER NOT NULL DEFAULT 0,
  next_review_at TIMESTAMPTZ,
  last_review_at TIMESTAMPTZ,
  suspended BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now()),
  CONSTRAINT cards_ef CHECK (ease_factor >= 1.3)
);

CREATE INDEX idx_cards_deck ON public.cards (deck_id);
CREATE INDEX idx_cards_next ON public.cards (next_review_at);

CREATE TABLE public.srs_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  card_id UUID NOT NULL REFERENCES public.cards (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  quality SMALLINT NOT NULL CHECK (quality BETWEEN 0 AND 5),
  ease_before DOUBLE PRECISION NOT NULL,
  interval_before INTEGER NOT NULL,
  repetitions_before INTEGER NOT NULL,
  ease_after DOUBLE PRECISION NOT NULL,
  interval_after INTEGER NOT NULL,
  repetitions_after INTEGER NOT NULL,
  next_review_after TIMESTAMPTZ NOT NULL,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now())
);

CREATE INDEX idx_srs_user ON public.srs_reviews (user_id, reviewed_at DESC);

------------------------------------------------------------------------------
-- sessions / exercises / submissions / scores
------------------------------------------------------------------------------
CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  kind public.session_kind NOT NULL DEFAULT 'practice',
  title TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now()),
  ended_at TIMESTAMPTZ,
  payload JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_sessions_user ON public.sessions (user_id, started_at DESC);

CREATE TABLE public.exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  skill public.exercise_skill NOT NULL,
  exercise_type TEXT NOT NULL,
  title TEXT NOT NULL,
  stimulus JSONB NOT NULL DEFAULT '{}',
  answer_schema JSONB,
  difficulty SMALLINT CHECK (difficulty BETWEEN 1 AND 5),
  published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now())
);

CREATE TABLE public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES public.exercises (id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.sessions (id) ON DELETE SET NULL,
  response JSONB NOT NULL DEFAULT '{}',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now())
);

CREATE TABLE public.scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  submission_id UUID NOT NULL UNIQUE REFERENCES public.submissions (id) ON DELETE CASCADE,
  breakdown JSONB NOT NULL DEFAULT '{}',
  total NUMERIC NOT NULL DEFAULT 0,
  graded_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now ())
);

------------------------------------------------------------------------------
-- triggers updated_at (Postgres 17: EXECUTE FUNCTION)
------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_updated_at ()
  RETURNS TRIGGER
  LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone ('utc', now ());
  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_profiles_updated BEFORE
UPDATE ON public.profiles FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at ();

CREATE TRIGGER tr_decks_updated BEFORE
UPDATE ON public.decks FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at ();

CREATE TRIGGER tr_cards_updated BEFORE
UPDATE ON public.cards FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at ();

------------------------------------------------------------------------------
-- signup → profiles
------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user ()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, avatar_url, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      SPLIT_PART(COALESCE(NEW.email,''), '@', 1)
    )
  )
  ON CONFLICT (id)
    DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user ();

------------------------------------------------------------------------------
-- grants (RLS là lớp bảo vệ giữa role JWT và dữ liệu)
------------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT ON public.exercises TO anon;

GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE ON public.profiles TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.decks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cards TO authenticated;
GRANT SELECT, INSERT ON public.srs_reviews TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions TO authenticated;

GRANT SELECT ON public.exercises TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.submissions TO authenticated;

GRANT SELECT ON public.scores TO authenticated;

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.srs_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;

------------------------------------------------------------------------------
-- policies
------------------------------------------------------------------------------
CREATE POLICY profiles_select_self ON public.profiles FOR SELECT
  USING (auth.uid () = id);

CREATE POLICY profiles_update_self ON public.profiles FOR UPDATE USING (auth.uid () = id)
WITH
  CHECK (auth.uid () = id);

CREATE POLICY decks_owner_all ON public.decks FOR ALL USING (owner_id = auth.uid ())
WITH
  CHECK (owner_id = auth.uid ());

CREATE POLICY cards_rw_owner ON public.cards FOR ALL USING (
  EXISTS (
    SELECT 1
    FROM public.decks d
    WHERE d.id = cards.deck_id
      AND d.owner_id = auth.uid ()
  )
)
WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.decks d
      WHERE d.id = deck_id
        AND d.owner_id = auth.uid ()
    )
  );

CREATE POLICY srs_select_owner ON public.srs_reviews FOR SELECT USING (
  user_id = auth.uid ()
);

CREATE POLICY srs_insert_owner ON public.srs_reviews FOR INSERT
WITH CHECK (
  user_id = auth.uid ()
    AND EXISTS (
      SELECT 1
      FROM public.cards c
      JOIN public.decks d ON d.id = c.deck_id
      WHERE c.id = card_id
        AND d.owner_id = auth.uid ()
    )
);

CREATE POLICY sessions_owner_all ON public.sessions FOR ALL USING (
  user_id = auth.uid ()
)
WITH CHECK (user_id = auth.uid ());

CREATE POLICY exercises_read_visible ON public.exercises FOR SELECT
  USING (published);

CREATE POLICY submissions_owner_rw ON public.submissions FOR ALL USING (
  user_id = auth.uid ()
)
WITH CHECK (user_id = auth.uid ());

CREATE POLICY scores_read_via_submissions ON public.scores FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.submissions s
      WHERE s.id = scores.submission_id
        AND s.user_id = auth.uid ()
    )
  );

------------------------------------------------------------------------------
-- seed exercise (deterministic UUID, idempotent)
------------------------------------------------------------------------------
INSERT INTO public.exercises (
  id,
  skill,
  exercise_type,
  title,
  stimulus,
  answer_schema
)
VALUES (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01'::uuid,
    'reading'::public.exercise_skill,
    'mcq',
    'Demo — meaning / context',
    '{"prompt":"\\\"Table\\\" trong câu: \\\"They tabled the motion.\\\" có nghĩa gần nhất?",
      "choices":[
        "Đưa vào một buổi họp không xác định / hoãn thảo luận",
        "Đặt lên mặt bàn",
        "Thông qua ngay",
        "Ghi vào spreadsheet"
      ]}'::jsonb,
    '{"correctIndex":0}'::jsonb
  ), (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02'::uuid,
    'listening'::public.exercise_skill,
    'placeholder',
    'Demo — Listening (placeholder)',
    '{"note":"Media & ASR được bổ sung ở module Listening phase sau."}'::jsonb,
    NULL::jsonb
  )
ON CONFLICT (id)
  DO NOTHING;
