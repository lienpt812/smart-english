-- Run only on Supabase projects because this migration depends on auth.users.
-- Local docker-compose PostgreSQL does not include the Supabase auth schema.
--
-- This file is intentionally idempotent because it may be pasted into the
-- Supabase SQL Editor more than once during early M1/M2 development.
--
-- M1: profiles + Supabase Auth trigger.
-- M2: core learning schema + RLS. REST is exposed by Supabase PostgREST:
--     /rest/v1/users, /rest/v1/decks, /rest/v1/cards, /rest/v1/srs_reviews,
--     /rest/v1/sessions, /rest/v1/exercises, /rest/v1/submissions,
--     /rest/v1/scores.

------------------------------------------------------------------------------
-- Extensions
------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

------------------------------------------------------------------------------
-- Types
------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typname = 'target_cert') THEN
    CREATE TYPE public.target_cert AS ENUM ('TOEIC', 'IELTS', 'COMMUNICATION');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typname = 'cefr_level') THEN
    CREATE TYPE public.cefr_level AS ENUM ('A1', 'A2', 'B1', 'B2', 'C1', 'C2');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typname = 'exercise_skill') THEN
    CREATE TYPE public.exercise_skill AS ENUM ('listening', 'speaking', 'reading', 'writing');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typname = 'session_kind') THEN
    CREATE TYPE public.session_kind AS ENUM ('practice', 'mock_exam', 'placement', 'tutor_chat');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typname = 'submission_status') THEN
    CREATE TYPE public.submission_status AS ENUM ('submitted', 'graded', 'needs_review');
  END IF;
END;
$$;

------------------------------------------------------------------------------
-- M1: profiles
-- auth.users is the canonical Supabase user table. public.profiles is the
-- application-facing user facade; public.users below is a REST view alias.
------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email TEXT,
  avatar_url TEXT,
  display_name TEXT,
  level public.cefr_level,
  target_cert public.target_cert,
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  locale TEXT NOT NULL DEFAULT 'vi-VN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now())
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS level public.cefr_level;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS target_cert public.target_cert;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'vi-VN';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_email_shape' AND conrelid = 'public.profiles'::regclass) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_email_shape CHECK (
        email IS NULL OR email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_display_name_len' AND conrelid = 'public.profiles'::regclass) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_display_name_len CHECK (
        display_name IS NULL OR char_length(display_name) BETWEEN 1 AND 120
      );
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (email);

DROP VIEW IF EXISTS public.users;

CREATE VIEW public.users
WITH (security_invoker = true)
AS
SELECT
  id,
  email,
  avatar_url,
  display_name,
  level,
  target_cert,
  onboarding_completed,
  locale,
  created_at,
  updated_at
FROM public.profiles;

------------------------------------------------------------------------------
-- M2: flashcards + SRS
------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  owner_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now())
);

ALTER TABLE public.decks ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.profiles (id) ON DELETE CASCADE;
ALTER TABLE public.decks ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.decks ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.decks ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.decks ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());
ALTER TABLE public.decks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'decks_name_len' AND conrelid = 'public.decks'::regclass) THEN
    ALTER TABLE public.decks
      ADD CONSTRAINT decks_name_len CHECK (char_length(trim(name)) BETWEEN 1 AND 160);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_decks_owner ON public.decks (owner_id);
CREATE INDEX IF NOT EXISTS idx_decks_public ON public.decks (is_public) WHERE is_public;

CREATE TABLE IF NOT EXISTS public.cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  deck_id UUID NOT NULL REFERENCES public.decks (id) ON DELETE CASCADE,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  hint TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  ease_factor DOUBLE PRECISION NOT NULL DEFAULT 2.5,
  interval_days INTEGER NOT NULL DEFAULT 0,
  repetitions INTEGER NOT NULL DEFAULT 0,
  next_review_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now()),
  last_review_at TIMESTAMPTZ,
  suspended BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now())
);

ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS deck_id UUID REFERENCES public.decks (id) ON DELETE CASCADE;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS front TEXT;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS back TEXT;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS hint TEXT;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS ease_factor DOUBLE PRECISION NOT NULL DEFAULT 2.5;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS interval_days INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS repetitions INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS next_review_at TIMESTAMPTZ DEFAULT timezone ('utc', now());
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS last_review_at TIMESTAMPTZ;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS suspended BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());

UPDATE public.cards SET next_review_at = timezone ('utc', now()) WHERE next_review_at IS NULL;
ALTER TABLE public.cards ALTER COLUMN next_review_at SET DEFAULT timezone ('utc', now());
ALTER TABLE public.cards ALTER COLUMN next_review_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cards_front_len' AND conrelid = 'public.cards'::regclass) THEN
    ALTER TABLE public.cards
      ADD CONSTRAINT cards_front_len CHECK (char_length(trim(front)) BETWEEN 1 AND 4000);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cards_back_len' AND conrelid = 'public.cards'::regclass) THEN
    ALTER TABLE public.cards
      ADD CONSTRAINT cards_back_len CHECK (char_length(trim(back)) BETWEEN 1 AND 4000);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cards_ease_factor' AND conrelid = 'public.cards'::regclass) THEN
    ALTER TABLE public.cards
      ADD CONSTRAINT cards_ease_factor CHECK (ease_factor >= 1.3);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cards_interval_nonnegative' AND conrelid = 'public.cards'::regclass) THEN
    ALTER TABLE public.cards
      ADD CONSTRAINT cards_interval_nonnegative CHECK (interval_days >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cards_repetitions_nonnegative' AND conrelid = 'public.cards'::regclass) THEN
    ALTER TABLE public.cards
      ADD CONSTRAINT cards_repetitions_nonnegative CHECK (repetitions >= 0);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_cards_deck ON public.cards (deck_id);
CREATE INDEX IF NOT EXISTS idx_cards_due ON public.cards (next_review_at) WHERE NOT suspended;
CREATE INDEX IF NOT EXISTS idx_cards_tags ON public.cards USING gin (tags);

CREATE TABLE IF NOT EXISTS public.srs_reviews (
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

ALTER TABLE public.srs_reviews ADD COLUMN IF NOT EXISTS card_id UUID REFERENCES public.cards (id) ON DELETE CASCADE;
ALTER TABLE public.srs_reviews ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles (id) ON DELETE CASCADE;
ALTER TABLE public.srs_reviews ADD COLUMN IF NOT EXISTS quality SMALLINT;
ALTER TABLE public.srs_reviews ADD COLUMN IF NOT EXISTS ease_before DOUBLE PRECISION;
ALTER TABLE public.srs_reviews ADD COLUMN IF NOT EXISTS interval_before INTEGER;
ALTER TABLE public.srs_reviews ADD COLUMN IF NOT EXISTS repetitions_before INTEGER;
ALTER TABLE public.srs_reviews ADD COLUMN IF NOT EXISTS ease_after DOUBLE PRECISION;
ALTER TABLE public.srs_reviews ADD COLUMN IF NOT EXISTS interval_after INTEGER;
ALTER TABLE public.srs_reviews ADD COLUMN IF NOT EXISTS repetitions_after INTEGER;
ALTER TABLE public.srs_reviews ADD COLUMN IF NOT EXISTS next_review_after TIMESTAMPTZ;
ALTER TABLE public.srs_reviews ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'srs_quality_range' AND conrelid = 'public.srs_reviews'::regclass) THEN
    ALTER TABLE public.srs_reviews ADD CONSTRAINT srs_quality_range CHECK (quality BETWEEN 0 AND 5);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'srs_ease_before' AND conrelid = 'public.srs_reviews'::regclass) THEN
    ALTER TABLE public.srs_reviews ADD CONSTRAINT srs_ease_before CHECK (ease_before >= 1.3);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'srs_ease_after' AND conrelid = 'public.srs_reviews'::regclass) THEN
    ALTER TABLE public.srs_reviews ADD CONSTRAINT srs_ease_after CHECK (ease_after >= 1.3);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'srs_interval_before' AND conrelid = 'public.srs_reviews'::regclass) THEN
    ALTER TABLE public.srs_reviews ADD CONSTRAINT srs_interval_before CHECK (interval_before >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'srs_interval_after' AND conrelid = 'public.srs_reviews'::regclass) THEN
    ALTER TABLE public.srs_reviews ADD CONSTRAINT srs_interval_after CHECK (interval_after >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'srs_repetitions_before' AND conrelid = 'public.srs_reviews'::regclass) THEN
    ALTER TABLE public.srs_reviews ADD CONSTRAINT srs_repetitions_before CHECK (repetitions_before >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'srs_repetitions_after' AND conrelid = 'public.srs_reviews'::regclass) THEN
    ALTER TABLE public.srs_reviews ADD CONSTRAINT srs_repetitions_after CHECK (repetitions_after >= 0);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_srs_user_reviewed ON public.srs_reviews (user_id, reviewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_srs_card_reviewed ON public.srs_reviews (card_id, reviewed_at DESC);

------------------------------------------------------------------------------
-- M2: sessions / exercises / submissions / scores
------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  kind public.session_kind NOT NULL DEFAULT 'practice',
  title TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now()),
  ended_at TIMESTAMPTZ,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now())
);

ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles (id) ON DELETE CASCADE;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS kind public.session_kind NOT NULL DEFAULT 'practice';
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS payload JSONB NOT NULL DEFAULT '{}';
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sessions_time_order' AND conrelid = 'public.sessions'::regclass) THEN
    ALTER TABLE public.sessions
      ADD CONSTRAINT sessions_time_order CHECK (ended_at IS NULL OR ended_at >= started_at);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_sessions_user_started ON public.sessions (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_kind ON public.sessions (kind);

CREATE TABLE IF NOT EXISTS public.exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  skill public.exercise_skill NOT NULL,
  exercise_type TEXT NOT NULL,
  title TEXT NOT NULL,
  stimulus JSONB NOT NULL DEFAULT '{}',
  answer_schema JSONB,
  difficulty SMALLINT CHECK (difficulty BETWEEN 1 AND 5),
  published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now())
);

ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS skill public.exercise_skill;
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS exercise_type TEXT;
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS stimulus JSONB NOT NULL DEFAULT '{}';
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS answer_schema JSONB;
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS difficulty SMALLINT;
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS published BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exercises_difficulty_range' AND conrelid = 'public.exercises'::regclass) THEN
    ALTER TABLE public.exercises ADD CONSTRAINT exercises_difficulty_range CHECK (difficulty BETWEEN 1 AND 5);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exercises_type_len' AND conrelid = 'public.exercises'::regclass) THEN
    ALTER TABLE public.exercises ADD CONSTRAINT exercises_type_len CHECK (char_length(trim(exercise_type)) BETWEEN 1 AND 80);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exercises_title_len' AND conrelid = 'public.exercises'::regclass) THEN
    ALTER TABLE public.exercises ADD CONSTRAINT exercises_title_len CHECK (char_length(trim(title)) BETWEEN 1 AND 240);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_exercises_skill_type ON public.exercises (skill, exercise_type);
CREATE INDEX IF NOT EXISTS idx_exercises_published ON public.exercises (published) WHERE published;

CREATE TABLE IF NOT EXISTS public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES public.exercises (id) ON DELETE RESTRICT,
  session_id UUID REFERENCES public.sessions (id) ON DELETE SET NULL,
  response JSONB NOT NULL DEFAULT '{}',
  status public.submission_status NOT NULL DEFAULT 'submitted',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now())
);

ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles (id) ON DELETE CASCADE;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS exercise_id UUID REFERENCES public.exercises (id) ON DELETE RESTRICT;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES public.sessions (id) ON DELETE SET NULL;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS response JSONB NOT NULL DEFAULT '{}';
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS status public.submission_status NOT NULL DEFAULT 'submitted';
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());

CREATE INDEX IF NOT EXISTS idx_submissions_user_submitted ON public.submissions (user_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_exercise ON public.submissions (exercise_id);
CREATE INDEX IF NOT EXISTS idx_submissions_session ON public.submissions (session_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON public.submissions (status);

CREATE TABLE IF NOT EXISTS public.scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  submission_id UUID NOT NULL UNIQUE REFERENCES public.submissions (id) ON DELETE CASCADE,
  breakdown JSONB NOT NULL DEFAULT '{}',
  total NUMERIC(8, 2) NOT NULL DEFAULT 0,
  max_total NUMERIC(8, 2) NOT NULL DEFAULT 100,
  graded_by TEXT NOT NULL DEFAULT 'system',
  graded_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now())
);

ALTER TABLE public.scores ADD COLUMN IF NOT EXISTS submission_id UUID REFERENCES public.submissions (id) ON DELETE CASCADE;
ALTER TABLE public.scores ADD COLUMN IF NOT EXISTS breakdown JSONB NOT NULL DEFAULT '{}';
ALTER TABLE public.scores ADD COLUMN IF NOT EXISTS total NUMERIC(8, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.scores ADD COLUMN IF NOT EXISTS max_total NUMERIC(8, 2) NOT NULL DEFAULT 100;
ALTER TABLE public.scores ADD COLUMN IF NOT EXISTS graded_by TEXT NOT NULL DEFAULT 'system';
ALTER TABLE public.scores ADD COLUMN IF NOT EXISTS graded_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());
ALTER TABLE public.scores ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'scores_submission_unique' AND conrelid = 'public.scores'::regclass) THEN
    ALTER TABLE public.scores ADD CONSTRAINT scores_submission_unique UNIQUE (submission_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'scores_total_nonnegative' AND conrelid = 'public.scores'::regclass) THEN
    ALTER TABLE public.scores ADD CONSTRAINT scores_total_nonnegative CHECK (total >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'scores_max_total_positive' AND conrelid = 'public.scores'::regclass) THEN
    ALTER TABLE public.scores ADD CONSTRAINT scores_max_total_positive CHECK (max_total > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'scores_total_within_max' AND conrelid = 'public.scores'::regclass) THEN
    ALTER TABLE public.scores ADD CONSTRAINT scores_total_within_max CHECK (total <= max_total);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_scores_submission ON public.scores (submission_id);
CREATE INDEX IF NOT EXISTS idx_scores_graded_at ON public.scores (graded_at DESC);

------------------------------------------------------------------------------
-- updated_at triggers
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

DROP TRIGGER IF EXISTS tr_profiles_updated ON public.profiles;
CREATE TRIGGER tr_profiles_updated BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at ();

DROP TRIGGER IF EXISTS tr_decks_updated ON public.decks;
CREATE TRIGGER tr_decks_updated BEFORE UPDATE ON public.decks
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at ();

DROP TRIGGER IF EXISTS tr_cards_updated ON public.cards;
CREATE TRIGGER tr_cards_updated BEFORE UPDATE ON public.cards
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at ();

DROP TRIGGER IF EXISTS tr_sessions_updated ON public.sessions;
CREATE TRIGGER tr_sessions_updated BEFORE UPDATE ON public.sessions
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at ();

DROP TRIGGER IF EXISTS tr_exercises_updated ON public.exercises;
CREATE TRIGGER tr_exercises_updated BEFORE UPDATE ON public.exercises
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at ();

DROP TRIGGER IF EXISTS tr_submissions_updated ON public.submissions;
CREATE TRIGGER tr_submissions_updated BEFORE UPDATE ON public.submissions
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at ();

DROP TRIGGER IF EXISTS tr_scores_updated ON public.scores;
CREATE TRIGGER tr_scores_updated BEFORE UPDATE ON public.scores
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at ();

------------------------------------------------------------------------------
-- signup -> profiles
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
      SPLIT_PART(COALESCE(NEW.email, ''), '@', 1)
    )
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user ();

------------------------------------------------------------------------------
-- Grants
-- RLS remains the data boundary between JWT roles and rows.
------------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT ON public.exercises TO anon;

GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, UPDATE ON public.users TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.decks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cards TO authenticated;
GRANT SELECT, INSERT ON public.srs_reviews TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions TO authenticated;
GRANT SELECT ON public.exercises TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.submissions TO authenticated;
GRANT SELECT ON public.scores TO authenticated;

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.srs_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.decks FORCE ROW LEVEL SECURITY;
ALTER TABLE public.cards FORCE ROW LEVEL SECURITY;
ALTER TABLE public.srs_reviews FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.exercises FORCE ROW LEVEL SECURITY;
ALTER TABLE public.submissions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.scores FORCE ROW LEVEL SECURITY;

------------------------------------------------------------------------------
-- Policies
------------------------------------------------------------------------------
DROP POLICY IF EXISTS profiles_select_self ON public.profiles;
DROP POLICY IF EXISTS profiles_update_self ON public.profiles;
DROP POLICY IF EXISTS decks_owner_all ON public.decks;
DROP POLICY IF EXISTS decks_select_visible ON public.decks;
DROP POLICY IF EXISTS decks_insert_owner ON public.decks;
DROP POLICY IF EXISTS decks_update_owner ON public.decks;
DROP POLICY IF EXISTS decks_delete_owner ON public.decks;
DROP POLICY IF EXISTS cards_rw_owner ON public.cards;
DROP POLICY IF EXISTS cards_select_visible ON public.cards;
DROP POLICY IF EXISTS cards_insert_owner ON public.cards;
DROP POLICY IF EXISTS cards_update_owner ON public.cards;
DROP POLICY IF EXISTS cards_delete_owner ON public.cards;
DROP POLICY IF EXISTS srs_select_owner ON public.srs_reviews;
DROP POLICY IF EXISTS srs_insert_owner ON public.srs_reviews;
DROP POLICY IF EXISTS srs_insert_owner_card ON public.srs_reviews;
DROP POLICY IF EXISTS sessions_owner_all ON public.sessions;
DROP POLICY IF EXISTS sessions_select_owner ON public.sessions;
DROP POLICY IF EXISTS sessions_insert_owner ON public.sessions;
DROP POLICY IF EXISTS sessions_update_owner ON public.sessions;
DROP POLICY IF EXISTS sessions_delete_owner ON public.sessions;
DROP POLICY IF EXISTS exercises_read_visible ON public.exercises;
DROP POLICY IF EXISTS exercises_read_published ON public.exercises;
DROP POLICY IF EXISTS submissions_owner_rw ON public.submissions;
DROP POLICY IF EXISTS submissions_select_owner ON public.submissions;
DROP POLICY IF EXISTS submissions_insert_owner_visible_exercise ON public.submissions;
DROP POLICY IF EXISTS submissions_update_owner_visible_links ON public.submissions;
DROP POLICY IF EXISTS submissions_delete_owner ON public.submissions;
DROP POLICY IF EXISTS scores_read_via_submissions ON public.scores;
DROP POLICY IF EXISTS scores_read_via_owned_submission ON public.scores;

CREATE POLICY profiles_select_self ON public.profiles FOR SELECT
  USING (auth.uid () = id);

CREATE POLICY profiles_update_self ON public.profiles FOR UPDATE
  USING (auth.uid () = id)
  WITH CHECK (auth.uid () = id);

CREATE POLICY decks_select_visible ON public.decks FOR SELECT
  USING (owner_id = auth.uid () OR is_public);

CREATE POLICY decks_insert_owner ON public.decks FOR INSERT
  WITH CHECK (owner_id = auth.uid ());

CREATE POLICY decks_update_owner ON public.decks FOR UPDATE
  USING (owner_id = auth.uid ())
  WITH CHECK (owner_id = auth.uid ());

CREATE POLICY decks_delete_owner ON public.decks FOR DELETE
  USING (owner_id = auth.uid ());

CREATE POLICY cards_select_visible ON public.cards FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.decks d
      WHERE d.id = cards.deck_id
        AND (d.owner_id = auth.uid () OR d.is_public)
    )
  );

CREATE POLICY cards_insert_owner ON public.cards FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.decks d
      WHERE d.id = deck_id
        AND d.owner_id = auth.uid ()
    )
  );

CREATE POLICY cards_update_owner ON public.cards FOR UPDATE
  USING (
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

CREATE POLICY cards_delete_owner ON public.cards FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.decks d
      WHERE d.id = cards.deck_id
        AND d.owner_id = auth.uid ()
    )
  );

CREATE POLICY srs_select_owner ON public.srs_reviews FOR SELECT
  USING (user_id = auth.uid ());

CREATE POLICY srs_insert_owner_card ON public.srs_reviews FOR INSERT
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

CREATE POLICY sessions_select_owner ON public.sessions FOR SELECT
  USING (user_id = auth.uid ());

CREATE POLICY sessions_insert_owner ON public.sessions FOR INSERT
  WITH CHECK (user_id = auth.uid ());

CREATE POLICY sessions_update_owner ON public.sessions FOR UPDATE
  USING (user_id = auth.uid ())
  WITH CHECK (user_id = auth.uid ());

CREATE POLICY sessions_delete_owner ON public.sessions FOR DELETE
  USING (user_id = auth.uid ());

CREATE POLICY exercises_read_published ON public.exercises FOR SELECT
  USING (published);

CREATE POLICY submissions_select_owner ON public.submissions FOR SELECT
  USING (user_id = auth.uid ());

CREATE POLICY submissions_insert_owner_visible_exercise ON public.submissions FOR INSERT
  WITH CHECK (
    user_id = auth.uid ()
      AND EXISTS (
        SELECT 1
        FROM public.exercises e
        WHERE e.id = exercise_id
          AND e.published
      )
      AND (
        session_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM public.sessions ss
            WHERE ss.id = session_id
              AND ss.user_id = auth.uid ()
          )
      )
  );

CREATE POLICY submissions_update_owner_visible_links ON public.submissions FOR UPDATE
  USING (user_id = auth.uid ())
  WITH CHECK (
    user_id = auth.uid ()
      AND EXISTS (
        SELECT 1
        FROM public.exercises e
        WHERE e.id = exercise_id
          AND e.published
      )
      AND (
        session_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM public.sessions ss
            WHERE ss.id = session_id
              AND ss.user_id = auth.uid ()
          )
      )
  );

CREATE POLICY submissions_delete_owner ON public.submissions FOR DELETE
  USING (user_id = auth.uid ());

CREATE POLICY scores_read_via_owned_submission ON public.scores FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.submissions s
      WHERE s.id = scores.submission_id
        AND s.user_id = auth.uid ()
    )
  );

------------------------------------------------------------------------------
-- Seed exercise data. Deterministic UUIDs keep this idempotent per migration.
------------------------------------------------------------------------------
INSERT INTO public.exercises (
  id,
  skill,
  exercise_type,
  title,
  stimulus,
  answer_schema,
  difficulty,
  published
)
VALUES
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01'::uuid,
    'reading'::public.exercise_skill,
    'mcq',
    'Demo - meaning in context',
    '{
      "prompt": "\"Table\" in the sentence \"They tabled the motion.\" is closest in meaning to:",
      "choices": [
        "Postpone or set aside discussion",
        "Put something on a table",
        "Approve immediately",
        "Enter data into a spreadsheet"
      ]
    }'::jsonb,
    '{"correctIndex": 0}'::jsonb,
    2,
    true
  ),
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02'::uuid,
    'listening'::public.exercise_skill,
    'placeholder',
    'Demo - listening placeholder',
    '{"note": "Media, transcript, and ASR will be implemented in the later Listening module."}'::jsonb,
    NULL::jsonb,
    1,
    true
  )
ON CONFLICT (id) DO UPDATE
SET
  skill = EXCLUDED.skill,
  exercise_type = EXCLUDED.exercise_type,
  title = EXCLUDED.title,
  stimulus = EXCLUDED.stimulus,
  answer_schema = EXCLUDED.answer_schema,
  difficulty = EXCLUDED.difficulty,
  published = EXCLUDED.published,
  updated_at = timezone ('utc', now());
