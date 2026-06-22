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
-- M7: reading library schema + RLS.
-- M8: dictation media/transcript/attempt schema + RLS.
-- M9: shadowing recording/feedback schema + RLS.
-- M10: writing task/submission/feedback schema + RLS.
-- M11: speaking prompt/session/attempt/feedback schema + RLS.
-- M12: listening lesson/quiz/audio job schema + RLS.
-- M14: TOEIC practice/mock test schema + RLS.

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

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typname = 'media_source_kind') THEN
    CREATE TYPE public.media_source_kind AS ENUM ('youtube_url', 'upload', 'direct_url');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typname = 'media_job_status') THEN
    CREATE TYPE public.media_job_status AS ENUM ('pending', 'processing', 'ready', 'failed');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typname = 'shadowing_mode') THEN
    CREATE TYPE public.shadowing_mode AS ENUM ('script_visible', 'script_hidden', 'simultaneous');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typname = 'listening_content_kind') THEN
    CREATE TYPE public.listening_content_kind AS ENUM ('dialogue', 'monologue', 'story', 'lecture', 'interview');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typname = 'toeic_section') THEN
    CREATE TYPE public.toeic_section AS ENUM ('listening', 'reading');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typname = 'toeic_attempt_status') THEN
    CREATE TYPE public.toeic_attempt_status AS ENUM ('in_progress', 'submitted', 'graded', 'abandoned');
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
  example TEXT,
  pronunciation TEXT,
  image_url TEXT,
  source_type TEXT,
  source_ref JSONB NOT NULL DEFAULT '{}',
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
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS example TEXT;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS pronunciation TEXT;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS source_type TEXT;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS source_ref JSONB NOT NULL DEFAULT '{}';
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
CREATE INDEX IF NOT EXISTS idx_cards_source_type ON public.cards (source_type);

CREATE TABLE IF NOT EXISTS public.deck_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  deck_id UUID NOT NULL REFERENCES public.decks (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now()),
  CONSTRAINT deck_ratings_unique_user_deck UNIQUE (deck_id, user_id)
);

ALTER TABLE public.deck_ratings ADD COLUMN IF NOT EXISTS deck_id UUID REFERENCES public.decks (id) ON DELETE CASCADE;
ALTER TABLE public.deck_ratings ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles (id) ON DELETE CASCADE;
ALTER TABLE public.deck_ratings ADD COLUMN IF NOT EXISTS rating SMALLINT;
ALTER TABLE public.deck_ratings ADD COLUMN IF NOT EXISTS review TEXT;
ALTER TABLE public.deck_ratings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());
ALTER TABLE public.deck_ratings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'deck_ratings_rating_range' AND conrelid = 'public.deck_ratings'::regclass) THEN
    ALTER TABLE public.deck_ratings ADD CONSTRAINT deck_ratings_rating_range CHECK (rating BETWEEN 1 AND 5);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'deck_ratings_unique_user_deck' AND conrelid = 'public.deck_ratings'::regclass) THEN
    ALTER TABLE public.deck_ratings ADD CONSTRAINT deck_ratings_unique_user_deck UNIQUE (deck_id, user_id);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_deck_ratings_deck ON public.deck_ratings (deck_id);
CREATE INDEX IF NOT EXISTS idx_deck_ratings_user ON public.deck_ratings (user_id);

CREATE TABLE IF NOT EXISTS public.deck_clones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  source_deck_id UUID NOT NULL REFERENCES public.decks (id) ON DELETE CASCADE,
  cloned_deck_id UUID NOT NULL REFERENCES public.decks (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now())
);

ALTER TABLE public.deck_clones ADD COLUMN IF NOT EXISTS source_deck_id UUID REFERENCES public.decks (id) ON DELETE CASCADE;
ALTER TABLE public.deck_clones ADD COLUMN IF NOT EXISTS cloned_deck_id UUID REFERENCES public.decks (id) ON DELETE CASCADE;
ALTER TABLE public.deck_clones ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles (id) ON DELETE CASCADE;
ALTER TABLE public.deck_clones ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());

CREATE INDEX IF NOT EXISTS idx_deck_clones_source ON public.deck_clones (source_deck_id);
CREATE INDEX IF NOT EXISTS idx_deck_clones_user ON public.deck_clones (user_id, created_at DESC);

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
-- M7: Reading library
------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reading_passages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  cefr_level public.cefr_level NOT NULL,
  topic TEXT NOT NULL,
  body TEXT NOT NULL,
  source_url TEXT,
  estimated_minutes SMALLINT NOT NULL DEFAULT 5,
  published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now())
);

ALTER TABLE public.reading_passages ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.reading_passages ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE public.reading_passages ADD COLUMN IF NOT EXISTS cefr_level public.cefr_level;
ALTER TABLE public.reading_passages ADD COLUMN IF NOT EXISTS topic TEXT;
ALTER TABLE public.reading_passages ADD COLUMN IF NOT EXISTS body TEXT;
ALTER TABLE public.reading_passages ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE public.reading_passages ADD COLUMN IF NOT EXISTS estimated_minutes SMALLINT NOT NULL DEFAULT 5;
ALTER TABLE public.reading_passages ADD COLUMN IF NOT EXISTS published BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.reading_passages ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());
ALTER TABLE public.reading_passages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reading_passages_slug_unique' AND conrelid = 'public.reading_passages'::regclass) THEN
    ALTER TABLE public.reading_passages ADD CONSTRAINT reading_passages_slug_unique UNIQUE (slug);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reading_passages_title_len' AND conrelid = 'public.reading_passages'::regclass) THEN
    ALTER TABLE public.reading_passages ADD CONSTRAINT reading_passages_title_len CHECK (char_length(trim(title)) BETWEEN 1 AND 240);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reading_passages_slug_len' AND conrelid = 'public.reading_passages'::regclass) THEN
    ALTER TABLE public.reading_passages ADD CONSTRAINT reading_passages_slug_len CHECK (char_length(trim(slug)) BETWEEN 1 AND 160);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reading_passages_body_len' AND conrelid = 'public.reading_passages'::regclass) THEN
    ALTER TABLE public.reading_passages ADD CONSTRAINT reading_passages_body_len CHECK (char_length(trim(body)) BETWEEN 120 AND 20000);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reading_passages_minutes_range' AND conrelid = 'public.reading_passages'::regclass) THEN
    ALTER TABLE public.reading_passages ADD CONSTRAINT reading_passages_minutes_range CHECK (estimated_minutes BETWEEN 1 AND 90);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_reading_passages_level_topic ON public.reading_passages (cefr_level, topic);
CREATE INDEX IF NOT EXISTS idx_reading_passages_published ON public.reading_passages (published) WHERE published;

CREATE TABLE IF NOT EXISTS public.reading_vocabulary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  passage_id UUID NOT NULL REFERENCES public.reading_passages (id) ON DELETE CASCADE,
  term TEXT NOT NULL,
  definition TEXT NOT NULL,
  example TEXT,
  cefr_level public.cefr_level,
  position_start INTEGER,
  position_end INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now())
);

ALTER TABLE public.reading_vocabulary ADD COLUMN IF NOT EXISTS passage_id UUID REFERENCES public.reading_passages (id) ON DELETE CASCADE;
ALTER TABLE public.reading_vocabulary ADD COLUMN IF NOT EXISTS term TEXT;
ALTER TABLE public.reading_vocabulary ADD COLUMN IF NOT EXISTS definition TEXT;
ALTER TABLE public.reading_vocabulary ADD COLUMN IF NOT EXISTS example TEXT;
ALTER TABLE public.reading_vocabulary ADD COLUMN IF NOT EXISTS cefr_level public.cefr_level;
ALTER TABLE public.reading_vocabulary ADD COLUMN IF NOT EXISTS position_start INTEGER;
ALTER TABLE public.reading_vocabulary ADD COLUMN IF NOT EXISTS position_end INTEGER;
ALTER TABLE public.reading_vocabulary ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());
ALTER TABLE public.reading_vocabulary ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reading_vocab_term_len' AND conrelid = 'public.reading_vocabulary'::regclass) THEN
    ALTER TABLE public.reading_vocabulary ADD CONSTRAINT reading_vocab_term_len CHECK (char_length(trim(term)) BETWEEN 1 AND 120);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reading_vocab_definition_len' AND conrelid = 'public.reading_vocabulary'::regclass) THEN
    ALTER TABLE public.reading_vocabulary ADD CONSTRAINT reading_vocab_definition_len CHECK (char_length(trim(definition)) BETWEEN 1 AND 2000);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reading_vocab_position_order' AND conrelid = 'public.reading_vocabulary'::regclass) THEN
    ALTER TABLE public.reading_vocabulary ADD CONSTRAINT reading_vocab_position_order CHECK (
      position_start IS NULL
        OR position_end IS NULL
        OR position_end >= position_start
    );
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_reading_vocab_passage ON public.reading_vocabulary (passage_id);
CREATE INDEX IF NOT EXISTS idx_reading_vocab_term ON public.reading_vocabulary (lower(term));

CREATE TABLE IF NOT EXISTS public.reading_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  passage_id UUID NOT NULL REFERENCES public.reading_passages (id) ON DELETE CASCADE,
  question_type TEXT NOT NULL DEFAULT 'mcq',
  prompt TEXT NOT NULL,
  choices JSONB NOT NULL DEFAULT '[]',
  answer_schema JSONB NOT NULL DEFAULT '{}',
  explanation TEXT,
  difficulty SMALLINT CHECK (difficulty BETWEEN 1 AND 5),
  position INTEGER NOT NULL DEFAULT 0,
  published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now())
);

ALTER TABLE public.reading_questions ADD COLUMN IF NOT EXISTS passage_id UUID REFERENCES public.reading_passages (id) ON DELETE CASCADE;
ALTER TABLE public.reading_questions ADD COLUMN IF NOT EXISTS question_type TEXT NOT NULL DEFAULT 'mcq';
ALTER TABLE public.reading_questions ADD COLUMN IF NOT EXISTS prompt TEXT;
ALTER TABLE public.reading_questions ADD COLUMN IF NOT EXISTS choices JSONB NOT NULL DEFAULT '[]';
ALTER TABLE public.reading_questions ADD COLUMN IF NOT EXISTS answer_schema JSONB NOT NULL DEFAULT '{}';
ALTER TABLE public.reading_questions ADD COLUMN IF NOT EXISTS explanation TEXT;
ALTER TABLE public.reading_questions ADD COLUMN IF NOT EXISTS difficulty SMALLINT;
ALTER TABLE public.reading_questions ADD COLUMN IF NOT EXISTS position INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.reading_questions ADD COLUMN IF NOT EXISTS published BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.reading_questions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());
ALTER TABLE public.reading_questions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reading_questions_type_len' AND conrelid = 'public.reading_questions'::regclass) THEN
    ALTER TABLE public.reading_questions ADD CONSTRAINT reading_questions_type_len CHECK (char_length(trim(question_type)) BETWEEN 1 AND 80);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reading_questions_prompt_len' AND conrelid = 'public.reading_questions'::regclass) THEN
    ALTER TABLE public.reading_questions ADD CONSTRAINT reading_questions_prompt_len CHECK (char_length(trim(prompt)) BETWEEN 1 AND 2000);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reading_questions_position_nonnegative' AND conrelid = 'public.reading_questions'::regclass) THEN
    ALTER TABLE public.reading_questions ADD CONSTRAINT reading_questions_position_nonnegative CHECK (position >= 0);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_reading_questions_passage_position ON public.reading_questions (passage_id, position);
CREATE INDEX IF NOT EXISTS idx_reading_questions_published ON public.reading_questions (published) WHERE published;

CREATE TABLE IF NOT EXISTS public.reading_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  passage_id UUID NOT NULL REFERENCES public.reading_passages (id) ON DELETE CASCADE,
  words_read INTEGER NOT NULL DEFAULT 0,
  vocabulary_added INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now()),
  CONSTRAINT reading_progress_unique_user_passage UNIQUE (user_id, passage_id)
);

ALTER TABLE public.reading_progress ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles (id) ON DELETE CASCADE;
ALTER TABLE public.reading_progress ADD COLUMN IF NOT EXISTS passage_id UUID REFERENCES public.reading_passages (id) ON DELETE CASCADE;
ALTER TABLE public.reading_progress ADD COLUMN IF NOT EXISTS words_read INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.reading_progress ADD COLUMN IF NOT EXISTS vocabulary_added INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.reading_progress ADD COLUMN IF NOT EXISTS completed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.reading_progress ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());
ALTER TABLE public.reading_progress ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());
ALTER TABLE public.reading_progress ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reading_progress_unique_user_passage' AND conrelid = 'public.reading_progress'::regclass) THEN
    ALTER TABLE public.reading_progress ADD CONSTRAINT reading_progress_unique_user_passage UNIQUE (user_id, passage_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reading_progress_counts_nonnegative' AND conrelid = 'public.reading_progress'::regclass) THEN
    ALTER TABLE public.reading_progress ADD CONSTRAINT reading_progress_counts_nonnegative CHECK (
      words_read >= 0
        AND vocabulary_added >= 0
    );
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_reading_progress_user_last ON public.reading_progress (user_id, last_read_at DESC);

CREATE TABLE IF NOT EXISTS public.learning_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  skill public.exercise_skill NOT NULL,
  error_type TEXT NOT NULL,
  source_type TEXT,
  source_ref JSONB NOT NULL DEFAULT '{}',
  message TEXT NOT NULL,
  severity SMALLINT CHECK (severity BETWEEN 1 AND 5),
  occurrences INTEGER NOT NULL DEFAULT 1,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now())
);

ALTER TABLE public.learning_errors ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles (id) ON DELETE CASCADE;
ALTER TABLE public.learning_errors ADD COLUMN IF NOT EXISTS skill public.exercise_skill;
ALTER TABLE public.learning_errors ADD COLUMN IF NOT EXISTS error_type TEXT;
ALTER TABLE public.learning_errors ADD COLUMN IF NOT EXISTS source_type TEXT;
ALTER TABLE public.learning_errors ADD COLUMN IF NOT EXISTS source_ref JSONB NOT NULL DEFAULT '{}';
ALTER TABLE public.learning_errors ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE public.learning_errors ADD COLUMN IF NOT EXISTS severity SMALLINT;
ALTER TABLE public.learning_errors ADD COLUMN IF NOT EXISTS occurrences INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.learning_errors ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());
ALTER TABLE public.learning_errors ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());
ALTER TABLE public.learning_errors ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'learning_errors_occurrences_positive' AND conrelid = 'public.learning_errors'::regclass) THEN
    ALTER TABLE public.learning_errors ADD CONSTRAINT learning_errors_occurrences_positive CHECK (occurrences > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'learning_errors_type_len' AND conrelid = 'public.learning_errors'::regclass) THEN
    ALTER TABLE public.learning_errors ADD CONSTRAINT learning_errors_type_len CHECK (char_length(trim(error_type)) BETWEEN 1 AND 120);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_learning_errors_user_skill ON public.learning_errors (user_id, skill, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_learning_errors_user_occurrences ON public.learning_errors (user_id, occurrences DESC);

------------------------------------------------------------------------------
-- M8: Dictation Engine
------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dictation_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  source_kind public.media_source_kind NOT NULL,
  source_url TEXT,
  storage_path TEXT,
  title TEXT,
  language_code TEXT NOT NULL DEFAULT 'en',
  status public.media_job_status NOT NULL DEFAULT 'pending',
  duration_ms INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now()),
  CONSTRAINT dictation_sources_location CHECK (
    source_url IS NOT NULL
      OR storage_path IS NOT NULL
  )
);

ALTER TABLE public.dictation_sources ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles (id) ON DELETE CASCADE;
ALTER TABLE public.dictation_sources ADD COLUMN IF NOT EXISTS source_kind public.media_source_kind;
ALTER TABLE public.dictation_sources ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE public.dictation_sources ADD COLUMN IF NOT EXISTS storage_path TEXT;
ALTER TABLE public.dictation_sources ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.dictation_sources ADD COLUMN IF NOT EXISTS language_code TEXT NOT NULL DEFAULT 'en';
ALTER TABLE public.dictation_sources ADD COLUMN IF NOT EXISTS status public.media_job_status NOT NULL DEFAULT 'pending';
ALTER TABLE public.dictation_sources ADD COLUMN IF NOT EXISTS duration_ms INTEGER;
ALTER TABLE public.dictation_sources ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';
ALTER TABLE public.dictation_sources ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE public.dictation_sources ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());
ALTER TABLE public.dictation_sources ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dictation_sources_location' AND conrelid = 'public.dictation_sources'::regclass) THEN
    ALTER TABLE public.dictation_sources ADD CONSTRAINT dictation_sources_location CHECK (
      source_url IS NOT NULL
        OR storage_path IS NOT NULL
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dictation_sources_duration_nonnegative' AND conrelid = 'public.dictation_sources'::regclass) THEN
    ALTER TABLE public.dictation_sources ADD CONSTRAINT dictation_sources_duration_nonnegative CHECK (
      duration_ms IS NULL
        OR duration_ms >= 0
    );
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_dictation_sources_user_status ON public.dictation_sources (user_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.transcript_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  source_id UUID NOT NULL REFERENCES public.dictation_sources (id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  start_ms INTEGER NOT NULL,
  end_ms INTEGER NOT NULL,
  text TEXT NOT NULL,
  normalized_text TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now()),
  CONSTRAINT transcript_segments_position_nonnegative CHECK (position >= 0),
  CONSTRAINT transcript_segments_time_order CHECK (end_ms >= start_ms)
);

ALTER TABLE public.transcript_segments ADD COLUMN IF NOT EXISTS source_id UUID REFERENCES public.dictation_sources (id) ON DELETE CASCADE;
ALTER TABLE public.transcript_segments ADD COLUMN IF NOT EXISTS position INTEGER;
ALTER TABLE public.transcript_segments ADD COLUMN IF NOT EXISTS start_ms INTEGER;
ALTER TABLE public.transcript_segments ADD COLUMN IF NOT EXISTS end_ms INTEGER;
ALTER TABLE public.transcript_segments ADD COLUMN IF NOT EXISTS text TEXT;
ALTER TABLE public.transcript_segments ADD COLUMN IF NOT EXISTS normalized_text TEXT;
ALTER TABLE public.transcript_segments ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';
ALTER TABLE public.transcript_segments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());
ALTER TABLE public.transcript_segments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transcript_segments_position_nonnegative' AND conrelid = 'public.transcript_segments'::regclass) THEN
    ALTER TABLE public.transcript_segments ADD CONSTRAINT transcript_segments_position_nonnegative CHECK (position >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transcript_segments_time_order' AND conrelid = 'public.transcript_segments'::regclass) THEN
    ALTER TABLE public.transcript_segments ADD CONSTRAINT transcript_segments_time_order CHECK (end_ms >= start_ms);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transcript_segments_text_len' AND conrelid = 'public.transcript_segments'::regclass) THEN
    ALTER TABLE public.transcript_segments ADD CONSTRAINT transcript_segments_text_len CHECK (char_length(trim(text)) BETWEEN 1 AND 4000);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transcript_segments_source_position_unique' AND conrelid = 'public.transcript_segments'::regclass) THEN
    ALTER TABLE public.transcript_segments ADD CONSTRAINT transcript_segments_source_position_unique UNIQUE (source_id, position);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_transcript_segments_source_position ON public.transcript_segments (source_id, position);
CREATE INDEX IF NOT EXISTS idx_transcript_segments_source_time ON public.transcript_segments (source_id, start_ms);

CREATE TABLE IF NOT EXISTS public.dictation_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES public.dictation_sources (id) ON DELETE CASCADE,
  segment_id UUID REFERENCES public.transcript_segments (id) ON DELETE SET NULL,
  typed_text TEXT NOT NULL,
  score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  max_score NUMERIC(5, 2) NOT NULL DEFAULT 100,
  scoring JSONB NOT NULL DEFAULT '{}',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now())
);

ALTER TABLE public.dictation_attempts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles (id) ON DELETE CASCADE;
ALTER TABLE public.dictation_attempts ADD COLUMN IF NOT EXISTS source_id UUID REFERENCES public.dictation_sources (id) ON DELETE CASCADE;
ALTER TABLE public.dictation_attempts ADD COLUMN IF NOT EXISTS segment_id UUID REFERENCES public.transcript_segments (id) ON DELETE SET NULL;
ALTER TABLE public.dictation_attempts ADD COLUMN IF NOT EXISTS typed_text TEXT;
ALTER TABLE public.dictation_attempts ADD COLUMN IF NOT EXISTS score NUMERIC(5, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.dictation_attempts ADD COLUMN IF NOT EXISTS max_score NUMERIC(5, 2) NOT NULL DEFAULT 100;
ALTER TABLE public.dictation_attempts ADD COLUMN IF NOT EXISTS scoring JSONB NOT NULL DEFAULT '{}';
ALTER TABLE public.dictation_attempts ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());
ALTER TABLE public.dictation_attempts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dictation_attempts_score_bounds' AND conrelid = 'public.dictation_attempts'::regclass) THEN
    ALTER TABLE public.dictation_attempts ADD CONSTRAINT dictation_attempts_score_bounds CHECK (
      score >= 0
        AND max_score > 0
        AND score <= max_score
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dictation_attempts_text_len' AND conrelid = 'public.dictation_attempts'::regclass) THEN
    ALTER TABLE public.dictation_attempts ADD CONSTRAINT dictation_attempts_text_len CHECK (char_length(trim(typed_text)) BETWEEN 1 AND 10000);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_dictation_attempts_user_submitted ON public.dictation_attempts (user_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_dictation_attempts_source ON public.dictation_attempts (source_id);
CREATE INDEX IF NOT EXISTS idx_dictation_attempts_segment ON public.dictation_attempts (segment_id);

CREATE TABLE IF NOT EXISTS public.dictation_error_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  attempt_id UUID NOT NULL REFERENCES public.dictation_attempts (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  expected_text TEXT,
  typed_text TEXT,
  error_type TEXT NOT NULL,
  explanation TEXT,
  card_id UUID REFERENCES public.cards (id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now()),
  CONSTRAINT dictation_error_items_position_nonnegative CHECK (position >= 0),
  CONSTRAINT dictation_error_items_type_len CHECK (char_length(trim(error_type)) BETWEEN 1 AND 80)
);

ALTER TABLE public.dictation_error_items ADD COLUMN IF NOT EXISTS attempt_id UUID REFERENCES public.dictation_attempts (id) ON DELETE CASCADE;
ALTER TABLE public.dictation_error_items ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles (id) ON DELETE CASCADE;
ALTER TABLE public.dictation_error_items ADD COLUMN IF NOT EXISTS position INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.dictation_error_items ADD COLUMN IF NOT EXISTS expected_text TEXT;
ALTER TABLE public.dictation_error_items ADD COLUMN IF NOT EXISTS typed_text TEXT;
ALTER TABLE public.dictation_error_items ADD COLUMN IF NOT EXISTS error_type TEXT;
ALTER TABLE public.dictation_error_items ADD COLUMN IF NOT EXISTS explanation TEXT;
ALTER TABLE public.dictation_error_items ADD COLUMN IF NOT EXISTS card_id UUID REFERENCES public.cards (id) ON DELETE SET NULL;
ALTER TABLE public.dictation_error_items ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';
ALTER TABLE public.dictation_error_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dictation_error_items_position_nonnegative' AND conrelid = 'public.dictation_error_items'::regclass) THEN
    ALTER TABLE public.dictation_error_items ADD CONSTRAINT dictation_error_items_position_nonnegative CHECK (position >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dictation_error_items_type_len' AND conrelid = 'public.dictation_error_items'::regclass) THEN
    ALTER TABLE public.dictation_error_items ADD CONSTRAINT dictation_error_items_type_len CHECK (char_length(trim(error_type)) BETWEEN 1 AND 80);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_dictation_error_items_attempt ON public.dictation_error_items (attempt_id, position);
CREATE INDEX IF NOT EXISTS idx_dictation_error_items_user ON public.dictation_error_items (user_id, created_at DESC);

------------------------------------------------------------------------------
-- M9: Shadowing Engine
------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shadowing_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES public.dictation_sources (id) ON DELETE CASCADE,
  segment_id UUID REFERENCES public.transcript_segments (id) ON DELETE SET NULL,
  mode public.shadowing_mode NOT NULL DEFAULT 'script_visible',
  recording_storage_path TEXT,
  recording_url TEXT,
  transcript_text TEXT,
  duration_ms INTEGER,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now()),
  CONSTRAINT shadowing_attempts_recording_location CHECK (
    recording_storage_path IS NOT NULL
      OR recording_url IS NOT NULL
  )
);

ALTER TABLE public.shadowing_attempts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles (id) ON DELETE CASCADE;
ALTER TABLE public.shadowing_attempts ADD COLUMN IF NOT EXISTS source_id UUID REFERENCES public.dictation_sources (id) ON DELETE CASCADE;
ALTER TABLE public.shadowing_attempts ADD COLUMN IF NOT EXISTS segment_id UUID REFERENCES public.transcript_segments (id) ON DELETE SET NULL;
ALTER TABLE public.shadowing_attempts ADD COLUMN IF NOT EXISTS mode public.shadowing_mode NOT NULL DEFAULT 'script_visible';
ALTER TABLE public.shadowing_attempts ADD COLUMN IF NOT EXISTS recording_storage_path TEXT;
ALTER TABLE public.shadowing_attempts ADD COLUMN IF NOT EXISTS recording_url TEXT;
ALTER TABLE public.shadowing_attempts ADD COLUMN IF NOT EXISTS transcript_text TEXT;
ALTER TABLE public.shadowing_attempts ADD COLUMN IF NOT EXISTS duration_ms INTEGER;
ALTER TABLE public.shadowing_attempts ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());
ALTER TABLE public.shadowing_attempts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shadowing_attempts_recording_location' AND conrelid = 'public.shadowing_attempts'::regclass) THEN
    ALTER TABLE public.shadowing_attempts ADD CONSTRAINT shadowing_attempts_recording_location CHECK (
      recording_storage_path IS NOT NULL
        OR recording_url IS NOT NULL
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shadowing_attempts_duration_nonnegative' AND conrelid = 'public.shadowing_attempts'::regclass) THEN
    ALTER TABLE public.shadowing_attempts ADD CONSTRAINT shadowing_attempts_duration_nonnegative CHECK (
      duration_ms IS NULL
        OR duration_ms >= 0
    );
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_shadowing_attempts_user_submitted ON public.shadowing_attempts (user_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_shadowing_attempts_source ON public.shadowing_attempts (source_id);
CREATE INDEX IF NOT EXISTS idx_shadowing_attempts_segment ON public.shadowing_attempts (segment_id);

CREATE TABLE IF NOT EXISTS public.shadowing_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  attempt_id UUID NOT NULL UNIQUE REFERENCES public.shadowing_attempts (id) ON DELETE CASCADE,
  pronunciation_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  fluency_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  rhythm_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  intonation_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  overall_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  feedback JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now())
);

ALTER TABLE public.shadowing_feedback ADD COLUMN IF NOT EXISTS attempt_id UUID REFERENCES public.shadowing_attempts (id) ON DELETE CASCADE;
ALTER TABLE public.shadowing_feedback ADD COLUMN IF NOT EXISTS pronunciation_score NUMERIC(5, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.shadowing_feedback ADD COLUMN IF NOT EXISTS fluency_score NUMERIC(5, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.shadowing_feedback ADD COLUMN IF NOT EXISTS rhythm_score NUMERIC(5, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.shadowing_feedback ADD COLUMN IF NOT EXISTS intonation_score NUMERIC(5, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.shadowing_feedback ADD COLUMN IF NOT EXISTS overall_score NUMERIC(5, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.shadowing_feedback ADD COLUMN IF NOT EXISTS feedback JSONB NOT NULL DEFAULT '{}';
ALTER TABLE public.shadowing_feedback ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());
ALTER TABLE public.shadowing_feedback ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shadowing_feedback_attempt_unique' AND conrelid = 'public.shadowing_feedback'::regclass) THEN
    ALTER TABLE public.shadowing_feedback ADD CONSTRAINT shadowing_feedback_attempt_unique UNIQUE (attempt_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shadowing_feedback_score_bounds' AND conrelid = 'public.shadowing_feedback'::regclass) THEN
    ALTER TABLE public.shadowing_feedback ADD CONSTRAINT shadowing_feedback_score_bounds CHECK (
      pronunciation_score BETWEEN 0 AND 100
        AND fluency_score BETWEEN 0 AND 100
        AND rhythm_score BETWEEN 0 AND 100
        AND intonation_score BETWEEN 0 AND 100
        AND overall_score BETWEEN 0 AND 100
    );
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_shadowing_feedback_attempt ON public.shadowing_feedback (attempt_id);

------------------------------------------------------------------------------
-- M10: Writing AI
------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.writing_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  title TEXT NOT NULL,
  task_type TEXT NOT NULL DEFAULT 'essay',
  prompt TEXT NOT NULL,
  cefr_level public.cefr_level,
  target_cert public.target_cert,
  time_limit_minutes SMALLINT,
  min_words INTEGER,
  max_words INTEGER,
  rubric JSONB NOT NULL DEFAULT '{}',
  sample_answer TEXT,
  published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now())
);

ALTER TABLE public.writing_tasks ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.writing_tasks ADD COLUMN IF NOT EXISTS task_type TEXT NOT NULL DEFAULT 'essay';
ALTER TABLE public.writing_tasks ADD COLUMN IF NOT EXISTS prompt TEXT;
ALTER TABLE public.writing_tasks ADD COLUMN IF NOT EXISTS cefr_level public.cefr_level;
ALTER TABLE public.writing_tasks ADD COLUMN IF NOT EXISTS target_cert public.target_cert;
ALTER TABLE public.writing_tasks ADD COLUMN IF NOT EXISTS time_limit_minutes SMALLINT;
ALTER TABLE public.writing_tasks ADD COLUMN IF NOT EXISTS min_words INTEGER;
ALTER TABLE public.writing_tasks ADD COLUMN IF NOT EXISTS max_words INTEGER;
ALTER TABLE public.writing_tasks ADD COLUMN IF NOT EXISTS rubric JSONB NOT NULL DEFAULT '{}';
ALTER TABLE public.writing_tasks ADD COLUMN IF NOT EXISTS sample_answer TEXT;
ALTER TABLE public.writing_tasks ADD COLUMN IF NOT EXISTS published BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.writing_tasks ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());
ALTER TABLE public.writing_tasks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'writing_tasks_title_len' AND conrelid = 'public.writing_tasks'::regclass) THEN
    ALTER TABLE public.writing_tasks ADD CONSTRAINT writing_tasks_title_len CHECK (char_length(trim(title)) BETWEEN 1 AND 240);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'writing_tasks_type_len' AND conrelid = 'public.writing_tasks'::regclass) THEN
    ALTER TABLE public.writing_tasks ADD CONSTRAINT writing_tasks_type_len CHECK (char_length(trim(task_type)) BETWEEN 1 AND 80);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'writing_tasks_prompt_len' AND conrelid = 'public.writing_tasks'::regclass) THEN
    ALTER TABLE public.writing_tasks ADD CONSTRAINT writing_tasks_prompt_len CHECK (char_length(trim(prompt)) BETWEEN 1 AND 6000);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'writing_tasks_word_bounds' AND conrelid = 'public.writing_tasks'::regclass) THEN
    ALTER TABLE public.writing_tasks ADD CONSTRAINT writing_tasks_word_bounds CHECK (
      (min_words IS NULL OR min_words >= 0)
        AND (max_words IS NULL OR max_words >= 0)
        AND (min_words IS NULL OR max_words IS NULL OR max_words >= min_words)
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'writing_tasks_time_limit_range' AND conrelid = 'public.writing_tasks'::regclass) THEN
    ALTER TABLE public.writing_tasks ADD CONSTRAINT writing_tasks_time_limit_range CHECK (
      time_limit_minutes IS NULL
        OR time_limit_minutes BETWEEN 1 AND 240
    );
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_writing_tasks_level_type ON public.writing_tasks (cefr_level, task_type);
CREATE INDEX IF NOT EXISTS idx_writing_tasks_published ON public.writing_tasks (published) WHERE published;

CREATE TABLE IF NOT EXISTS public.writing_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.writing_tasks (id) ON DELETE SET NULL,
  title TEXT,
  content TEXT NOT NULL,
  word_count INTEGER NOT NULL DEFAULT 0,
  status public.submission_status NOT NULL DEFAULT 'submitted',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now())
);

ALTER TABLE public.writing_submissions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles (id) ON DELETE CASCADE;
ALTER TABLE public.writing_submissions ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES public.writing_tasks (id) ON DELETE SET NULL;
ALTER TABLE public.writing_submissions ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.writing_submissions ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE public.writing_submissions ADD COLUMN IF NOT EXISTS word_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.writing_submissions ADD COLUMN IF NOT EXISTS status public.submission_status NOT NULL DEFAULT 'submitted';
ALTER TABLE public.writing_submissions ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());
ALTER TABLE public.writing_submissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'writing_submissions_content_len' AND conrelid = 'public.writing_submissions'::regclass) THEN
    ALTER TABLE public.writing_submissions ADD CONSTRAINT writing_submissions_content_len CHECK (char_length(trim(content)) BETWEEN 1 AND 50000);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'writing_submissions_word_count_nonnegative' AND conrelid = 'public.writing_submissions'::regclass) THEN
    ALTER TABLE public.writing_submissions ADD CONSTRAINT writing_submissions_word_count_nonnegative CHECK (word_count >= 0);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_writing_submissions_user_submitted ON public.writing_submissions (user_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_writing_submissions_task ON public.writing_submissions (task_id);
CREATE INDEX IF NOT EXISTS idx_writing_submissions_status ON public.writing_submissions (status);

CREATE TABLE IF NOT EXISTS public.writing_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  submission_id UUID NOT NULL UNIQUE REFERENCES public.writing_submissions (id) ON DELETE CASCADE,
  total_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  max_score NUMERIC(5, 2) NOT NULL DEFAULT 100,
  rubric_breakdown JSONB NOT NULL DEFAULT '{}',
  inline_comments JSONB NOT NULL DEFAULT '[]',
  strengths JSONB NOT NULL DEFAULT '[]',
  issues JSONB NOT NULL DEFAULT '[]',
  revised_sample TEXT,
  feedback JSONB NOT NULL DEFAULT '{}',
  graded_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now())
);

ALTER TABLE public.writing_feedback ADD COLUMN IF NOT EXISTS submission_id UUID REFERENCES public.writing_submissions (id) ON DELETE CASCADE;
ALTER TABLE public.writing_feedback ADD COLUMN IF NOT EXISTS total_score NUMERIC(5, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.writing_feedback ADD COLUMN IF NOT EXISTS max_score NUMERIC(5, 2) NOT NULL DEFAULT 100;
ALTER TABLE public.writing_feedback ADD COLUMN IF NOT EXISTS rubric_breakdown JSONB NOT NULL DEFAULT '{}';
ALTER TABLE public.writing_feedback ADD COLUMN IF NOT EXISTS inline_comments JSONB NOT NULL DEFAULT '[]';
ALTER TABLE public.writing_feedback ADD COLUMN IF NOT EXISTS strengths JSONB NOT NULL DEFAULT '[]';
ALTER TABLE public.writing_feedback ADD COLUMN IF NOT EXISTS issues JSONB NOT NULL DEFAULT '[]';
ALTER TABLE public.writing_feedback ADD COLUMN IF NOT EXISTS revised_sample TEXT;
ALTER TABLE public.writing_feedback ADD COLUMN IF NOT EXISTS feedback JSONB NOT NULL DEFAULT '{}';
ALTER TABLE public.writing_feedback ADD COLUMN IF NOT EXISTS graded_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());
ALTER TABLE public.writing_feedback ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'writing_feedback_submission_unique' AND conrelid = 'public.writing_feedback'::regclass) THEN
    ALTER TABLE public.writing_feedback ADD CONSTRAINT writing_feedback_submission_unique UNIQUE (submission_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'writing_feedback_score_bounds' AND conrelid = 'public.writing_feedback'::regclass) THEN
    ALTER TABLE public.writing_feedback ADD CONSTRAINT writing_feedback_score_bounds CHECK (
      total_score >= 0
        AND max_score > 0
        AND total_score <= max_score
    );
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_writing_feedback_submission ON public.writing_feedback (submission_id);
CREATE INDEX IF NOT EXISTS idx_writing_feedback_graded ON public.writing_feedback (graded_at DESC);

------------------------------------------------------------------------------
-- M11: Speaking AI
------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.speaking_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  title TEXT NOT NULL,
  prompt_type TEXT NOT NULL DEFAULT 'short_answer',
  prompt TEXT NOT NULL,
  cefr_level public.cefr_level,
  target_cert public.target_cert,
  topic TEXT,
  expected_duration_seconds SMALLINT,
  rubric JSONB NOT NULL DEFAULT '{}',
  sample_answer TEXT,
  published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now())
);

ALTER TABLE public.speaking_prompts ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.speaking_prompts ADD COLUMN IF NOT EXISTS prompt_type TEXT NOT NULL DEFAULT 'short_answer';
ALTER TABLE public.speaking_prompts ADD COLUMN IF NOT EXISTS prompt TEXT;
ALTER TABLE public.speaking_prompts ADD COLUMN IF NOT EXISTS cefr_level public.cefr_level;
ALTER TABLE public.speaking_prompts ADD COLUMN IF NOT EXISTS target_cert public.target_cert;
ALTER TABLE public.speaking_prompts ADD COLUMN IF NOT EXISTS topic TEXT;
ALTER TABLE public.speaking_prompts ADD COLUMN IF NOT EXISTS expected_duration_seconds SMALLINT;
ALTER TABLE public.speaking_prompts ADD COLUMN IF NOT EXISTS rubric JSONB NOT NULL DEFAULT '{}';
ALTER TABLE public.speaking_prompts ADD COLUMN IF NOT EXISTS sample_answer TEXT;
ALTER TABLE public.speaking_prompts ADD COLUMN IF NOT EXISTS published BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.speaking_prompts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());
ALTER TABLE public.speaking_prompts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'speaking_prompts_title_len' AND conrelid = 'public.speaking_prompts'::regclass) THEN
    ALTER TABLE public.speaking_prompts ADD CONSTRAINT speaking_prompts_title_len CHECK (char_length(trim(title)) BETWEEN 1 AND 240);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'speaking_prompts_type_len' AND conrelid = 'public.speaking_prompts'::regclass) THEN
    ALTER TABLE public.speaking_prompts ADD CONSTRAINT speaking_prompts_type_len CHECK (char_length(trim(prompt_type)) BETWEEN 1 AND 80);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'speaking_prompts_prompt_len' AND conrelid = 'public.speaking_prompts'::regclass) THEN
    ALTER TABLE public.speaking_prompts ADD CONSTRAINT speaking_prompts_prompt_len CHECK (char_length(trim(prompt)) BETWEEN 1 AND 6000);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'speaking_prompts_duration_range' AND conrelid = 'public.speaking_prompts'::regclass) THEN
    ALTER TABLE public.speaking_prompts ADD CONSTRAINT speaking_prompts_duration_range CHECK (
      expected_duration_seconds IS NULL
        OR expected_duration_seconds BETWEEN 5 AND 1800
    );
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_speaking_prompts_level_topic ON public.speaking_prompts (cefr_level, topic);
CREATE INDEX IF NOT EXISTS idx_speaking_prompts_published ON public.speaking_prompts (published) WHERE published;

CREATE TABLE IF NOT EXISTS public.speaking_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  prompt_id UUID REFERENCES public.speaking_prompts (id) ON DELETE SET NULL,
  session_mode TEXT NOT NULL DEFAULT 'practice',
  title TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  started_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now()),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now())
);

ALTER TABLE public.speaking_sessions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles (id) ON DELETE CASCADE;
ALTER TABLE public.speaking_sessions ADD COLUMN IF NOT EXISTS prompt_id UUID REFERENCES public.speaking_prompts (id) ON DELETE SET NULL;
ALTER TABLE public.speaking_sessions ADD COLUMN IF NOT EXISTS session_mode TEXT NOT NULL DEFAULT 'practice';
ALTER TABLE public.speaking_sessions ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.speaking_sessions ADD COLUMN IF NOT EXISTS payload JSONB NOT NULL DEFAULT '{}';
ALTER TABLE public.speaking_sessions ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());
ALTER TABLE public.speaking_sessions ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;
ALTER TABLE public.speaking_sessions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());
ALTER TABLE public.speaking_sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'speaking_sessions_mode_len' AND conrelid = 'public.speaking_sessions'::regclass) THEN
    ALTER TABLE public.speaking_sessions ADD CONSTRAINT speaking_sessions_mode_len CHECK (char_length(trim(session_mode)) BETWEEN 1 AND 80);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'speaking_sessions_time_order' AND conrelid = 'public.speaking_sessions'::regclass) THEN
    ALTER TABLE public.speaking_sessions ADD CONSTRAINT speaking_sessions_time_order CHECK (ended_at IS NULL OR ended_at >= started_at);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_speaking_sessions_user_started ON public.speaking_sessions (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_speaking_sessions_prompt ON public.speaking_sessions (prompt_id);

CREATE TABLE IF NOT EXISTS public.speaking_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.speaking_sessions (id) ON DELETE SET NULL,
  prompt_id UUID REFERENCES public.speaking_prompts (id) ON DELETE SET NULL,
  recording_storage_path TEXT,
  recording_url TEXT,
  transcript_text TEXT,
  duration_ms INTEGER,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now()),
  CONSTRAINT speaking_attempts_recording_location CHECK (
    recording_storage_path IS NOT NULL
      OR recording_url IS NOT NULL
      OR transcript_text IS NOT NULL
  )
);

ALTER TABLE public.speaking_attempts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles (id) ON DELETE CASCADE;
ALTER TABLE public.speaking_attempts ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES public.speaking_sessions (id) ON DELETE SET NULL;
ALTER TABLE public.speaking_attempts ADD COLUMN IF NOT EXISTS prompt_id UUID REFERENCES public.speaking_prompts (id) ON DELETE SET NULL;
ALTER TABLE public.speaking_attempts ADD COLUMN IF NOT EXISTS recording_storage_path TEXT;
ALTER TABLE public.speaking_attempts ADD COLUMN IF NOT EXISTS recording_url TEXT;
ALTER TABLE public.speaking_attempts ADD COLUMN IF NOT EXISTS transcript_text TEXT;
ALTER TABLE public.speaking_attempts ADD COLUMN IF NOT EXISTS duration_ms INTEGER;
ALTER TABLE public.speaking_attempts ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());
ALTER TABLE public.speaking_attempts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'speaking_attempts_recording_location' AND conrelid = 'public.speaking_attempts'::regclass) THEN
    ALTER TABLE public.speaking_attempts ADD CONSTRAINT speaking_attempts_recording_location CHECK (
      recording_storage_path IS NOT NULL
        OR recording_url IS NOT NULL
        OR transcript_text IS NOT NULL
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'speaking_attempts_duration_nonnegative' AND conrelid = 'public.speaking_attempts'::regclass) THEN
    ALTER TABLE public.speaking_attempts ADD CONSTRAINT speaking_attempts_duration_nonnegative CHECK (
      duration_ms IS NULL
        OR duration_ms >= 0
    );
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_speaking_attempts_user_submitted ON public.speaking_attempts (user_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_speaking_attempts_session ON public.speaking_attempts (session_id);
CREATE INDEX IF NOT EXISTS idx_speaking_attempts_prompt ON public.speaking_attempts (prompt_id);

CREATE TABLE IF NOT EXISTS public.speaking_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  attempt_id UUID NOT NULL UNIQUE REFERENCES public.speaking_attempts (id) ON DELETE CASCADE,
  pronunciation_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  fluency_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  vocabulary_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  coherence_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  overall_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  feedback JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now())
);

ALTER TABLE public.speaking_feedback ADD COLUMN IF NOT EXISTS attempt_id UUID REFERENCES public.speaking_attempts (id) ON DELETE CASCADE;
ALTER TABLE public.speaking_feedback ADD COLUMN IF NOT EXISTS pronunciation_score NUMERIC(5, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.speaking_feedback ADD COLUMN IF NOT EXISTS fluency_score NUMERIC(5, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.speaking_feedback ADD COLUMN IF NOT EXISTS vocabulary_score NUMERIC(5, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.speaking_feedback ADD COLUMN IF NOT EXISTS coherence_score NUMERIC(5, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.speaking_feedback ADD COLUMN IF NOT EXISTS overall_score NUMERIC(5, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.speaking_feedback ADD COLUMN IF NOT EXISTS feedback JSONB NOT NULL DEFAULT '{}';
ALTER TABLE public.speaking_feedback ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());
ALTER TABLE public.speaking_feedback ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'speaking_feedback_attempt_unique' AND conrelid = 'public.speaking_feedback'::regclass) THEN
    ALTER TABLE public.speaking_feedback ADD CONSTRAINT speaking_feedback_attempt_unique UNIQUE (attempt_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'speaking_feedback_score_bounds' AND conrelid = 'public.speaking_feedback'::regclass) THEN
    ALTER TABLE public.speaking_feedback ADD CONSTRAINT speaking_feedback_score_bounds CHECK (
      pronunciation_score BETWEEN 0 AND 100
        AND fluency_score BETWEEN 0 AND 100
        AND vocabulary_score BETWEEN 0 AND 100
        AND coherence_score BETWEEN 0 AND 100
        AND overall_score BETWEEN 0 AND 100
    );
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_speaking_feedback_attempt ON public.speaking_feedback (attempt_id);

CREATE TABLE IF NOT EXISTS public.speaking_drills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  prompt_id UUID REFERENCES public.speaking_prompts (id) ON DELETE SET NULL,
  focus_type TEXT NOT NULL DEFAULT 'pronunciation',
  target_text TEXT NOT NULL,
  target_sound TEXT,
  instructions JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now()),
  CONSTRAINT speaking_drills_focus_len CHECK (char_length(trim(focus_type)) BETWEEN 1 AND 80),
  CONSTRAINT speaking_drills_target_len CHECK (char_length(trim(target_text)) BETWEEN 1 AND 2000)
);

ALTER TABLE public.speaking_drills ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles (id) ON DELETE CASCADE;
ALTER TABLE public.speaking_drills ADD COLUMN IF NOT EXISTS prompt_id UUID REFERENCES public.speaking_prompts (id) ON DELETE SET NULL;
ALTER TABLE public.speaking_drills ADD COLUMN IF NOT EXISTS focus_type TEXT NOT NULL DEFAULT 'pronunciation';
ALTER TABLE public.speaking_drills ADD COLUMN IF NOT EXISTS target_text TEXT;
ALTER TABLE public.speaking_drills ADD COLUMN IF NOT EXISTS target_sound TEXT;
ALTER TABLE public.speaking_drills ADD COLUMN IF NOT EXISTS instructions JSONB NOT NULL DEFAULT '{}';
ALTER TABLE public.speaking_drills ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE public.speaking_drills ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());
ALTER TABLE public.speaking_drills ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'speaking_drills_focus_len' AND conrelid = 'public.speaking_drills'::regclass) THEN
    ALTER TABLE public.speaking_drills ADD CONSTRAINT speaking_drills_focus_len CHECK (char_length(trim(focus_type)) BETWEEN 1 AND 80);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'speaking_drills_target_len' AND conrelid = 'public.speaking_drills'::regclass) THEN
    ALTER TABLE public.speaking_drills ADD CONSTRAINT speaking_drills_target_len CHECK (char_length(trim(target_text)) BETWEEN 1 AND 2000);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_speaking_drills_user_created ON public.speaking_drills (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_speaking_drills_prompt ON public.speaking_drills (prompt_id);

------------------------------------------------------------------------------
-- M12: Listening AI
------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.listening_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  owner_id UUID REFERENCES public.profiles (id) ON DELETE CASCADE,
  source_id UUID REFERENCES public.dictation_sources (id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  topic TEXT NOT NULL,
  level public.cefr_level,
  content_kind public.listening_content_kind NOT NULL DEFAULT 'dialogue',
  transcript_text TEXT NOT NULL,
  dialogue JSONB NOT NULL DEFAULT '[]',
  audio_url TEXT,
  audio_storage_path TEXT,
  audio_metadata JSONB NOT NULL DEFAULT '{}',
  speed_options NUMERIC[] NOT NULL DEFAULT ARRAY[0.5, 0.75, 1.0, 1.25, 1.5],
  published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now()),
  CONSTRAINT listening_lessons_title_len CHECK (char_length(trim(title)) BETWEEN 1 AND 240),
  CONSTRAINT listening_lessons_topic_len CHECK (char_length(trim(topic)) BETWEEN 1 AND 160),
  CONSTRAINT listening_lessons_transcript_len CHECK (char_length(trim(transcript_text)) BETWEEN 1 AND 60000)
);

ALTER TABLE public.listening_lessons ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.profiles (id) ON DELETE CASCADE;
ALTER TABLE public.listening_lessons ADD COLUMN IF NOT EXISTS source_id UUID REFERENCES public.dictation_sources (id) ON DELETE SET NULL;
ALTER TABLE public.listening_lessons ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.listening_lessons ADD COLUMN IF NOT EXISTS topic TEXT;
ALTER TABLE public.listening_lessons ADD COLUMN IF NOT EXISTS level public.cefr_level;
ALTER TABLE public.listening_lessons ADD COLUMN IF NOT EXISTS content_kind public.listening_content_kind NOT NULL DEFAULT 'dialogue';
ALTER TABLE public.listening_lessons ADD COLUMN IF NOT EXISTS transcript_text TEXT;
ALTER TABLE public.listening_lessons ADD COLUMN IF NOT EXISTS dialogue JSONB NOT NULL DEFAULT '[]';
ALTER TABLE public.listening_lessons ADD COLUMN IF NOT EXISTS audio_url TEXT;
ALTER TABLE public.listening_lessons ADD COLUMN IF NOT EXISTS audio_storage_path TEXT;
ALTER TABLE public.listening_lessons ADD COLUMN IF NOT EXISTS audio_metadata JSONB NOT NULL DEFAULT '{}';
ALTER TABLE public.listening_lessons ADD COLUMN IF NOT EXISTS speed_options NUMERIC[] NOT NULL DEFAULT ARRAY[0.5, 0.75, 1.0, 1.25, 1.5];
ALTER TABLE public.listening_lessons ADD COLUMN IF NOT EXISTS published BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.listening_lessons ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());
ALTER TABLE public.listening_lessons ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'listening_lessons_title_len' AND conrelid = 'public.listening_lessons'::regclass) THEN
    ALTER TABLE public.listening_lessons ADD CONSTRAINT listening_lessons_title_len CHECK (char_length(trim(title)) BETWEEN 1 AND 240);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'listening_lessons_topic_len' AND conrelid = 'public.listening_lessons'::regclass) THEN
    ALTER TABLE public.listening_lessons ADD CONSTRAINT listening_lessons_topic_len CHECK (char_length(trim(topic)) BETWEEN 1 AND 160);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'listening_lessons_transcript_len' AND conrelid = 'public.listening_lessons'::regclass) THEN
    ALTER TABLE public.listening_lessons ADD CONSTRAINT listening_lessons_transcript_len CHECK (char_length(trim(transcript_text)) BETWEEN 1 AND 60000);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_listening_lessons_owner_created ON public.listening_lessons (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listening_lessons_published ON public.listening_lessons (published, level) WHERE published;
CREATE INDEX IF NOT EXISTS idx_listening_lessons_source ON public.listening_lessons (source_id);

CREATE TABLE IF NOT EXISTS public.listening_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  lesson_id UUID NOT NULL REFERENCES public.listening_lessons (id) ON DELETE CASCADE,
  question_type TEXT NOT NULL DEFAULT 'mcq',
  prompt TEXT NOT NULL,
  choices JSONB NOT NULL DEFAULT '[]',
  answer JSONB NOT NULL DEFAULT '{}',
  explanation TEXT,
  skill_focus TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now()),
  CONSTRAINT listening_questions_prompt_len CHECK (char_length(trim(prompt)) BETWEEN 1 AND 2000),
  CONSTRAINT listening_questions_position_nonnegative CHECK (position >= 0)
);

ALTER TABLE public.listening_questions ADD COLUMN IF NOT EXISTS lesson_id UUID REFERENCES public.listening_lessons (id) ON DELETE CASCADE;
ALTER TABLE public.listening_questions ADD COLUMN IF NOT EXISTS question_type TEXT NOT NULL DEFAULT 'mcq';
ALTER TABLE public.listening_questions ADD COLUMN IF NOT EXISTS prompt TEXT;
ALTER TABLE public.listening_questions ADD COLUMN IF NOT EXISTS choices JSONB NOT NULL DEFAULT '[]';
ALTER TABLE public.listening_questions ADD COLUMN IF NOT EXISTS answer JSONB NOT NULL DEFAULT '{}';
ALTER TABLE public.listening_questions ADD COLUMN IF NOT EXISTS explanation TEXT;
ALTER TABLE public.listening_questions ADD COLUMN IF NOT EXISTS skill_focus TEXT;
ALTER TABLE public.listening_questions ADD COLUMN IF NOT EXISTS position INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.listening_questions ADD COLUMN IF NOT EXISTS published BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.listening_questions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());
ALTER TABLE public.listening_questions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'listening_questions_prompt_len' AND conrelid = 'public.listening_questions'::regclass) THEN
    ALTER TABLE public.listening_questions ADD CONSTRAINT listening_questions_prompt_len CHECK (char_length(trim(prompt)) BETWEEN 1 AND 2000);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'listening_questions_position_nonnegative' AND conrelid = 'public.listening_questions'::regclass) THEN
    ALTER TABLE public.listening_questions ADD CONSTRAINT listening_questions_position_nonnegative CHECK (position >= 0);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_listening_questions_lesson_position ON public.listening_questions (lesson_id, position);
CREATE INDEX IF NOT EXISTS idx_listening_questions_published ON public.listening_questions (published) WHERE published;

CREATE TABLE IF NOT EXISTS public.listening_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.listening_lessons (id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.sessions (id) ON DELETE SET NULL,
  responses JSONB NOT NULL DEFAULT '{}',
  score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  max_score NUMERIC(5, 2) NOT NULL DEFAULT 100,
  feedback JSONB NOT NULL DEFAULT '{}',
  completed_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now()),
  CONSTRAINT listening_attempts_score_bounds CHECK (score >= 0 AND max_score > 0 AND score <= max_score)
);

ALTER TABLE public.listening_attempts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles (id) ON DELETE CASCADE;
ALTER TABLE public.listening_attempts ADD COLUMN IF NOT EXISTS lesson_id UUID REFERENCES public.listening_lessons (id) ON DELETE CASCADE;
ALTER TABLE public.listening_attempts ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES public.sessions (id) ON DELETE SET NULL;
ALTER TABLE public.listening_attempts ADD COLUMN IF NOT EXISTS responses JSONB NOT NULL DEFAULT '{}';
ALTER TABLE public.listening_attempts ADD COLUMN IF NOT EXISTS score NUMERIC(5, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.listening_attempts ADD COLUMN IF NOT EXISTS max_score NUMERIC(5, 2) NOT NULL DEFAULT 100;
ALTER TABLE public.listening_attempts ADD COLUMN IF NOT EXISTS feedback JSONB NOT NULL DEFAULT '{}';
ALTER TABLE public.listening_attempts ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());
ALTER TABLE public.listening_attempts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());
ALTER TABLE public.listening_attempts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'listening_attempts_score_bounds' AND conrelid = 'public.listening_attempts'::regclass) THEN
    ALTER TABLE public.listening_attempts ADD CONSTRAINT listening_attempts_score_bounds CHECK (score >= 0 AND max_score > 0 AND score <= max_score);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_listening_attempts_user_completed ON public.listening_attempts (user_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_listening_attempts_lesson ON public.listening_attempts (lesson_id);
CREATE INDEX IF NOT EXISTS idx_listening_attempts_session ON public.listening_attempts (session_id);

CREATE TABLE IF NOT EXISTS public.listening_audio_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  lesson_id UUID NOT NULL REFERENCES public.listening_lessons (id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles (id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'gemini',
  model TEXT,
  voice TEXT,
  speed NUMERIC(3, 2) NOT NULL DEFAULT 1.0,
  status public.media_job_status NOT NULL DEFAULT 'pending',
  audio_url TEXT,
  storage_path TEXT,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now()),
  CONSTRAINT listening_audio_jobs_speed_bounds CHECK (speed BETWEEN 0.5 AND 1.5)
);

ALTER TABLE public.listening_audio_jobs ADD COLUMN IF NOT EXISTS lesson_id UUID REFERENCES public.listening_lessons (id) ON DELETE CASCADE;
ALTER TABLE public.listening_audio_jobs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles (id) ON DELETE CASCADE;
ALTER TABLE public.listening_audio_jobs ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'gemini';
ALTER TABLE public.listening_audio_jobs ADD COLUMN IF NOT EXISTS model TEXT;
ALTER TABLE public.listening_audio_jobs ADD COLUMN IF NOT EXISTS voice TEXT;
ALTER TABLE public.listening_audio_jobs ADD COLUMN IF NOT EXISTS speed NUMERIC(3, 2) NOT NULL DEFAULT 1.0;
ALTER TABLE public.listening_audio_jobs ADD COLUMN IF NOT EXISTS status public.media_job_status NOT NULL DEFAULT 'pending';
ALTER TABLE public.listening_audio_jobs ADD COLUMN IF NOT EXISTS audio_url TEXT;
ALTER TABLE public.listening_audio_jobs ADD COLUMN IF NOT EXISTS storage_path TEXT;
ALTER TABLE public.listening_audio_jobs ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE public.listening_audio_jobs ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';
ALTER TABLE public.listening_audio_jobs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());
ALTER TABLE public.listening_audio_jobs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'listening_audio_jobs_speed_bounds' AND conrelid = 'public.listening_audio_jobs'::regclass) THEN
    ALTER TABLE public.listening_audio_jobs ADD CONSTRAINT listening_audio_jobs_speed_bounds CHECK (speed BETWEEN 0.5 AND 1.5);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_listening_audio_jobs_lesson_created ON public.listening_audio_jobs (lesson_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listening_audio_jobs_user_created ON public.listening_audio_jobs (user_id, created_at DESC);

------------------------------------------------------------------------------
-- M14: TOEIC practice/mock tests
------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.toeic_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  owner_id UUID REFERENCES public.profiles (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  test_mode TEXT NOT NULL DEFAULT 'mini',
  target_score INTEGER,
  duration_minutes INTEGER NOT NULL DEFAULT 20,
  sections public.toeic_section[] NOT NULL DEFAULT ARRAY['listening', 'reading']::public.toeic_section[],
  generated_by TEXT NOT NULL DEFAULT 'system',
  metadata JSONB NOT NULL DEFAULT '{}',
  published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now())
);

ALTER TABLE public.toeic_tests ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.profiles (id) ON DELETE CASCADE;
ALTER TABLE public.toeic_tests ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.toeic_tests ADD COLUMN IF NOT EXISTS test_mode TEXT NOT NULL DEFAULT 'mini';
ALTER TABLE public.toeic_tests ADD COLUMN IF NOT EXISTS target_score INTEGER;
ALTER TABLE public.toeic_tests ADD COLUMN IF NOT EXISTS duration_minutes INTEGER NOT NULL DEFAULT 20;
ALTER TABLE public.toeic_tests ADD COLUMN IF NOT EXISTS sections public.toeic_section[] NOT NULL DEFAULT ARRAY['listening', 'reading']::public.toeic_section[];
ALTER TABLE public.toeic_tests ADD COLUMN IF NOT EXISTS generated_by TEXT NOT NULL DEFAULT 'system';
ALTER TABLE public.toeic_tests ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';
ALTER TABLE public.toeic_tests ADD COLUMN IF NOT EXISTS published BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.toeic_tests ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());
ALTER TABLE public.toeic_tests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'toeic_tests_title_len' AND conrelid = 'public.toeic_tests'::regclass) THEN
    ALTER TABLE public.toeic_tests ADD CONSTRAINT toeic_tests_title_len CHECK (char_length(trim(title)) BETWEEN 1 AND 240);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'toeic_tests_mode_allowed' AND conrelid = 'public.toeic_tests'::regclass) THEN
    ALTER TABLE public.toeic_tests ADD CONSTRAINT toeic_tests_mode_allowed CHECK (test_mode IN ('mini', 'section', 'full'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'toeic_tests_target_score_bounds' AND conrelid = 'public.toeic_tests'::regclass) THEN
    ALTER TABLE public.toeic_tests ADD CONSTRAINT toeic_tests_target_score_bounds CHECK (target_score IS NULL OR target_score BETWEEN 10 AND 990);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'toeic_tests_duration_bounds' AND conrelid = 'public.toeic_tests'::regclass) THEN
    ALTER TABLE public.toeic_tests ADD CONSTRAINT toeic_tests_duration_bounds CHECK (duration_minutes BETWEEN 1 AND 180);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_toeic_tests_owner_created ON public.toeic_tests (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_toeic_tests_published ON public.toeic_tests (published, test_mode) WHERE published;

CREATE TABLE IF NOT EXISTS public.toeic_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  test_id UUID NOT NULL REFERENCES public.toeic_tests (id) ON DELETE CASCADE,
  section public.toeic_section NOT NULL,
  part SMALLINT NOT NULL,
  question_number INTEGER NOT NULL,
  prompt TEXT NOT NULL,
  choices JSONB NOT NULL DEFAULT '[]',
  answer_schema JSONB NOT NULL DEFAULT '{}',
  explanation TEXT,
  passage TEXT,
  audio_url TEXT,
  image_url TEXT,
  difficulty SMALLINT CHECK (difficulty BETWEEN 1 AND 5),
  metadata JSONB NOT NULL DEFAULT '{}',
  published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now()),
  UNIQUE (test_id, question_number)
);

ALTER TABLE public.toeic_questions ADD COLUMN IF NOT EXISTS test_id UUID REFERENCES public.toeic_tests (id) ON DELETE CASCADE;
ALTER TABLE public.toeic_questions ADD COLUMN IF NOT EXISTS section public.toeic_section;
ALTER TABLE public.toeic_questions ADD COLUMN IF NOT EXISTS part SMALLINT;
ALTER TABLE public.toeic_questions ADD COLUMN IF NOT EXISTS question_number INTEGER;
ALTER TABLE public.toeic_questions ADD COLUMN IF NOT EXISTS prompt TEXT;
ALTER TABLE public.toeic_questions ADD COLUMN IF NOT EXISTS choices JSONB NOT NULL DEFAULT '[]';
ALTER TABLE public.toeic_questions ADD COLUMN IF NOT EXISTS answer_schema JSONB NOT NULL DEFAULT '{}';
ALTER TABLE public.toeic_questions ADD COLUMN IF NOT EXISTS explanation TEXT;
ALTER TABLE public.toeic_questions ADD COLUMN IF NOT EXISTS passage TEXT;
ALTER TABLE public.toeic_questions ADD COLUMN IF NOT EXISTS audio_url TEXT;
ALTER TABLE public.toeic_questions ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.toeic_questions ADD COLUMN IF NOT EXISTS difficulty SMALLINT;
ALTER TABLE public.toeic_questions ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';
ALTER TABLE public.toeic_questions ADD COLUMN IF NOT EXISTS published BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.toeic_questions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());
ALTER TABLE public.toeic_questions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'toeic_questions_part_bounds' AND conrelid = 'public.toeic_questions'::regclass) THEN
    ALTER TABLE public.toeic_questions ADD CONSTRAINT toeic_questions_part_bounds CHECK (part BETWEEN 1 AND 7);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'toeic_questions_number_positive' AND conrelid = 'public.toeic_questions'::regclass) THEN
    ALTER TABLE public.toeic_questions ADD CONSTRAINT toeic_questions_number_positive CHECK (question_number > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'toeic_questions_prompt_len' AND conrelid = 'public.toeic_questions'::regclass) THEN
    ALTER TABLE public.toeic_questions ADD CONSTRAINT toeic_questions_prompt_len CHECK (char_length(trim(prompt)) BETWEEN 1 AND 12000);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'toeic_questions_difficulty_bounds' AND conrelid = 'public.toeic_questions'::regclass) THEN
    ALTER TABLE public.toeic_questions ADD CONSTRAINT toeic_questions_difficulty_bounds CHECK (difficulty IS NULL OR difficulty BETWEEN 1 AND 5);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_toeic_questions_test_number ON public.toeic_questions (test_id, question_number);
CREATE INDEX IF NOT EXISTS idx_toeic_questions_part ON public.toeic_questions (section, part);

CREATE TABLE IF NOT EXISTS public.toeic_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  test_id UUID REFERENCES public.toeic_tests (id) ON DELETE SET NULL,
  session_id UUID REFERENCES public.sessions (id) ON DELETE SET NULL,
  status public.toeic_attempt_status NOT NULL DEFAULT 'in_progress',
  started_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now()),
  submitted_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  score_total INTEGER,
  listening_score INTEGER,
  reading_score INTEGER,
  analysis JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now())
);

ALTER TABLE public.toeic_attempts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles (id) ON DELETE CASCADE;
ALTER TABLE public.toeic_attempts ADD COLUMN IF NOT EXISTS test_id UUID REFERENCES public.toeic_tests (id) ON DELETE SET NULL;
ALTER TABLE public.toeic_attempts ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES public.sessions (id) ON DELETE SET NULL;
ALTER TABLE public.toeic_attempts ADD COLUMN IF NOT EXISTS status public.toeic_attempt_status NOT NULL DEFAULT 'in_progress';
ALTER TABLE public.toeic_attempts ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());
ALTER TABLE public.toeic_attempts ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE public.toeic_attempts ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;
ALTER TABLE public.toeic_attempts ADD COLUMN IF NOT EXISTS score_total INTEGER;
ALTER TABLE public.toeic_attempts ADD COLUMN IF NOT EXISTS listening_score INTEGER;
ALTER TABLE public.toeic_attempts ADD COLUMN IF NOT EXISTS reading_score INTEGER;
ALTER TABLE public.toeic_attempts ADD COLUMN IF NOT EXISTS analysis JSONB NOT NULL DEFAULT '{}';
ALTER TABLE public.toeic_attempts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());
ALTER TABLE public.toeic_attempts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'toeic_attempts_score_bounds' AND conrelid = 'public.toeic_attempts'::regclass) THEN
    ALTER TABLE public.toeic_attempts ADD CONSTRAINT toeic_attempts_score_bounds CHECK (
      (score_total IS NULL OR score_total BETWEEN 10 AND 990)
        AND (listening_score IS NULL OR listening_score BETWEEN 5 AND 495)
        AND (reading_score IS NULL OR reading_score BETWEEN 5 AND 495)
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'toeic_attempts_duration_nonnegative' AND conrelid = 'public.toeic_attempts'::regclass) THEN
    ALTER TABLE public.toeic_attempts ADD CONSTRAINT toeic_attempts_duration_nonnegative CHECK (duration_seconds IS NULL OR duration_seconds >= 0);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_toeic_attempts_user_started ON public.toeic_attempts (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_toeic_attempts_test ON public.toeic_attempts (test_id);

CREATE TABLE IF NOT EXISTS public.toeic_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  attempt_id UUID NOT NULL REFERENCES public.toeic_attempts (id) ON DELETE CASCADE,
  question_id UUID REFERENCES public.toeic_questions (id) ON DELETE SET NULL,
  question_number INTEGER NOT NULL,
  response JSONB NOT NULL DEFAULT '{}',
  is_correct BOOLEAN,
  score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  feedback JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now()),
  UNIQUE (attempt_id, question_number)
);

ALTER TABLE public.toeic_responses ADD COLUMN IF NOT EXISTS attempt_id UUID REFERENCES public.toeic_attempts (id) ON DELETE CASCADE;
ALTER TABLE public.toeic_responses ADD COLUMN IF NOT EXISTS question_id UUID REFERENCES public.toeic_questions (id) ON DELETE SET NULL;
ALTER TABLE public.toeic_responses ADD COLUMN IF NOT EXISTS question_number INTEGER;
ALTER TABLE public.toeic_responses ADD COLUMN IF NOT EXISTS response JSONB NOT NULL DEFAULT '{}';
ALTER TABLE public.toeic_responses ADD COLUMN IF NOT EXISTS is_correct BOOLEAN;
ALTER TABLE public.toeic_responses ADD COLUMN IF NOT EXISTS score NUMERIC(5, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.toeic_responses ADD COLUMN IF NOT EXISTS feedback JSONB NOT NULL DEFAULT '{}';
ALTER TABLE public.toeic_responses ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());
ALTER TABLE public.toeic_responses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone ('utc', now());

CREATE INDEX IF NOT EXISTS idx_toeic_responses_attempt ON public.toeic_responses (attempt_id);
CREATE INDEX IF NOT EXISTS idx_toeic_responses_question ON public.toeic_responses (question_id);

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

DROP TRIGGER IF EXISTS tr_deck_ratings_updated ON public.deck_ratings;
CREATE TRIGGER tr_deck_ratings_updated BEFORE UPDATE ON public.deck_ratings
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

DROP TRIGGER IF EXISTS tr_reading_passages_updated ON public.reading_passages;
CREATE TRIGGER tr_reading_passages_updated BEFORE UPDATE ON public.reading_passages
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at ();

DROP TRIGGER IF EXISTS tr_reading_vocabulary_updated ON public.reading_vocabulary;
CREATE TRIGGER tr_reading_vocabulary_updated BEFORE UPDATE ON public.reading_vocabulary
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at ();

DROP TRIGGER IF EXISTS tr_reading_questions_updated ON public.reading_questions;
CREATE TRIGGER tr_reading_questions_updated BEFORE UPDATE ON public.reading_questions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at ();

DROP TRIGGER IF EXISTS tr_reading_progress_updated ON public.reading_progress;
CREATE TRIGGER tr_reading_progress_updated BEFORE UPDATE ON public.reading_progress
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at ();

DROP TRIGGER IF EXISTS tr_learning_errors_updated ON public.learning_errors;
CREATE TRIGGER tr_learning_errors_updated BEFORE UPDATE ON public.learning_errors
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at ();

DROP TRIGGER IF EXISTS tr_dictation_sources_updated ON public.dictation_sources;
CREATE TRIGGER tr_dictation_sources_updated BEFORE UPDATE ON public.dictation_sources
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at ();

DROP TRIGGER IF EXISTS tr_transcript_segments_updated ON public.transcript_segments;
CREATE TRIGGER tr_transcript_segments_updated BEFORE UPDATE ON public.transcript_segments
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at ();

DROP TRIGGER IF EXISTS tr_dictation_attempts_updated ON public.dictation_attempts;
CREATE TRIGGER tr_dictation_attempts_updated BEFORE UPDATE ON public.dictation_attempts
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at ();

DROP TRIGGER IF EXISTS tr_shadowing_attempts_updated ON public.shadowing_attempts;
CREATE TRIGGER tr_shadowing_attempts_updated BEFORE UPDATE ON public.shadowing_attempts
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at ();

DROP TRIGGER IF EXISTS tr_shadowing_feedback_updated ON public.shadowing_feedback;
CREATE TRIGGER tr_shadowing_feedback_updated BEFORE UPDATE ON public.shadowing_feedback
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at ();

DROP TRIGGER IF EXISTS tr_writing_tasks_updated ON public.writing_tasks;
CREATE TRIGGER tr_writing_tasks_updated BEFORE UPDATE ON public.writing_tasks
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at ();

DROP TRIGGER IF EXISTS tr_writing_submissions_updated ON public.writing_submissions;
CREATE TRIGGER tr_writing_submissions_updated BEFORE UPDATE ON public.writing_submissions
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at ();

DROP TRIGGER IF EXISTS tr_writing_feedback_updated ON public.writing_feedback;
CREATE TRIGGER tr_writing_feedback_updated BEFORE UPDATE ON public.writing_feedback
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at ();

DROP TRIGGER IF EXISTS tr_speaking_prompts_updated ON public.speaking_prompts;
CREATE TRIGGER tr_speaking_prompts_updated BEFORE UPDATE ON public.speaking_prompts
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at ();

DROP TRIGGER IF EXISTS tr_speaking_sessions_updated ON public.speaking_sessions;
CREATE TRIGGER tr_speaking_sessions_updated BEFORE UPDATE ON public.speaking_sessions
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at ();

DROP TRIGGER IF EXISTS tr_speaking_attempts_updated ON public.speaking_attempts;
CREATE TRIGGER tr_speaking_attempts_updated BEFORE UPDATE ON public.speaking_attempts
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at ();

DROP TRIGGER IF EXISTS tr_speaking_feedback_updated ON public.speaking_feedback;
CREATE TRIGGER tr_speaking_feedback_updated BEFORE UPDATE ON public.speaking_feedback
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at ();

DROP TRIGGER IF EXISTS tr_speaking_drills_updated ON public.speaking_drills;
CREATE TRIGGER tr_speaking_drills_updated BEFORE UPDATE ON public.speaking_drills
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at ();

DROP TRIGGER IF EXISTS tr_listening_lessons_updated ON public.listening_lessons;
CREATE TRIGGER tr_listening_lessons_updated BEFORE UPDATE ON public.listening_lessons
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at ();

DROP TRIGGER IF EXISTS tr_listening_questions_updated ON public.listening_questions;
CREATE TRIGGER tr_listening_questions_updated BEFORE UPDATE ON public.listening_questions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at ();

DROP TRIGGER IF EXISTS tr_listening_attempts_updated ON public.listening_attempts;
CREATE TRIGGER tr_listening_attempts_updated BEFORE UPDATE ON public.listening_attempts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at ();

DROP TRIGGER IF EXISTS tr_listening_audio_jobs_updated ON public.listening_audio_jobs;
CREATE TRIGGER tr_listening_audio_jobs_updated BEFORE UPDATE ON public.listening_audio_jobs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at ();

DROP TRIGGER IF EXISTS tr_toeic_tests_updated ON public.toeic_tests;
CREATE TRIGGER tr_toeic_tests_updated BEFORE UPDATE ON public.toeic_tests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at ();

DROP TRIGGER IF EXISTS tr_toeic_questions_updated ON public.toeic_questions;
CREATE TRIGGER tr_toeic_questions_updated BEFORE UPDATE ON public.toeic_questions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at ();

DROP TRIGGER IF EXISTS tr_toeic_attempts_updated ON public.toeic_attempts;
CREATE TRIGGER tr_toeic_attempts_updated BEFORE UPDATE ON public.toeic_attempts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at ();

DROP TRIGGER IF EXISTS tr_toeic_responses_updated ON public.toeic_responses;
CREATE TRIGGER tr_toeic_responses_updated BEFORE UPDATE ON public.toeic_responses
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
GRANT SELECT ON public.reading_passages TO anon;
GRANT SELECT ON public.reading_vocabulary TO anon;
GRANT SELECT ON public.reading_questions TO anon;

GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, UPDATE ON public.users TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.decks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cards TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deck_ratings TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.deck_clones TO authenticated;
GRANT SELECT, INSERT ON public.srs_reviews TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions TO authenticated;
GRANT SELECT ON public.exercises TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.submissions TO authenticated;
GRANT SELECT ON public.scores TO authenticated;
GRANT SELECT ON public.reading_passages TO authenticated;
GRANT SELECT ON public.reading_vocabulary TO authenticated;
GRANT SELECT ON public.reading_questions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reading_progress TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.learning_errors TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dictation_sources TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transcript_segments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dictation_attempts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dictation_error_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shadowing_attempts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shadowing_feedback TO authenticated;
GRANT SELECT ON public.writing_tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.writing_submissions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.writing_feedback TO authenticated;
GRANT SELECT ON public.speaking_prompts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.speaking_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.speaking_attempts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.speaking_feedback TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.speaking_drills TO authenticated;
GRANT SELECT ON public.listening_lessons TO anon;
GRANT SELECT ON public.listening_questions TO anon;
GRANT SELECT ON public.toeic_tests TO anon;
GRANT SELECT ON public.toeic_questions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listening_lessons TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listening_questions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listening_attempts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listening_audio_jobs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.toeic_tests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.toeic_questions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.toeic_attempts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.toeic_responses TO authenticated;

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deck_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deck_clones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.srs_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_passages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_vocabulary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dictation_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcript_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dictation_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dictation_error_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shadowing_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shadowing_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.writing_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.writing_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.writing_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.speaking_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.speaking_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.speaking_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.speaking_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.speaking_drills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listening_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listening_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listening_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listening_audio_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.toeic_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.toeic_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.toeic_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.toeic_responses ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.decks FORCE ROW LEVEL SECURITY;
ALTER TABLE public.cards FORCE ROW LEVEL SECURITY;
ALTER TABLE public.deck_ratings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.deck_clones FORCE ROW LEVEL SECURITY;
ALTER TABLE public.srs_reviews FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.exercises FORCE ROW LEVEL SECURITY;
ALTER TABLE public.submissions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.scores FORCE ROW LEVEL SECURITY;
ALTER TABLE public.reading_passages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.reading_vocabulary FORCE ROW LEVEL SECURITY;
ALTER TABLE public.reading_questions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.reading_progress FORCE ROW LEVEL SECURITY;
ALTER TABLE public.learning_errors FORCE ROW LEVEL SECURITY;
ALTER TABLE public.dictation_sources FORCE ROW LEVEL SECURITY;
ALTER TABLE public.transcript_segments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.dictation_attempts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.dictation_error_items FORCE ROW LEVEL SECURITY;
ALTER TABLE public.shadowing_attempts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.shadowing_feedback FORCE ROW LEVEL SECURITY;
ALTER TABLE public.writing_tasks FORCE ROW LEVEL SECURITY;
ALTER TABLE public.writing_submissions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.writing_feedback FORCE ROW LEVEL SECURITY;
ALTER TABLE public.speaking_prompts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.speaking_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.speaking_attempts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.speaking_feedback FORCE ROW LEVEL SECURITY;
ALTER TABLE public.speaking_drills FORCE ROW LEVEL SECURITY;
ALTER TABLE public.listening_lessons FORCE ROW LEVEL SECURITY;
ALTER TABLE public.listening_questions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.listening_attempts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.listening_audio_jobs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.toeic_tests FORCE ROW LEVEL SECURITY;
ALTER TABLE public.toeic_questions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.toeic_attempts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.toeic_responses FORCE ROW LEVEL SECURITY;

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
DROP POLICY IF EXISTS deck_ratings_select_visible ON public.deck_ratings;
DROP POLICY IF EXISTS deck_ratings_insert_visible ON public.deck_ratings;
DROP POLICY IF EXISTS deck_ratings_update_self ON public.deck_ratings;
DROP POLICY IF EXISTS deck_ratings_delete_self ON public.deck_ratings;
DROP POLICY IF EXISTS deck_clones_owner_all ON public.deck_clones;
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
DROP POLICY IF EXISTS reading_passages_read_published ON public.reading_passages;
DROP POLICY IF EXISTS reading_vocabulary_read_published_passage ON public.reading_vocabulary;
DROP POLICY IF EXISTS reading_questions_read_published_passage ON public.reading_questions;
DROP POLICY IF EXISTS reading_progress_owner_all ON public.reading_progress;
DROP POLICY IF EXISTS learning_errors_owner_all ON public.learning_errors;
DROP POLICY IF EXISTS dictation_sources_owner_all ON public.dictation_sources;
DROP POLICY IF EXISTS transcript_segments_owner_all ON public.transcript_segments;
DROP POLICY IF EXISTS dictation_attempts_owner_all ON public.dictation_attempts;
DROP POLICY IF EXISTS dictation_error_items_owner_all ON public.dictation_error_items;
DROP POLICY IF EXISTS shadowing_attempts_owner_all ON public.shadowing_attempts;
DROP POLICY IF EXISTS shadowing_feedback_owner_all ON public.shadowing_feedback;
DROP POLICY IF EXISTS writing_tasks_read_published ON public.writing_tasks;
DROP POLICY IF EXISTS writing_submissions_owner_all ON public.writing_submissions;
DROP POLICY IF EXISTS writing_feedback_owner_all ON public.writing_feedback;
DROP POLICY IF EXISTS speaking_prompts_read_published ON public.speaking_prompts;
DROP POLICY IF EXISTS speaking_sessions_owner_all ON public.speaking_sessions;
DROP POLICY IF EXISTS speaking_attempts_owner_all ON public.speaking_attempts;
DROP POLICY IF EXISTS speaking_feedback_owner_all ON public.speaking_feedback;
DROP POLICY IF EXISTS speaking_drills_owner_all ON public.speaking_drills;
DROP POLICY IF EXISTS listening_lessons_select_visible ON public.listening_lessons;
DROP POLICY IF EXISTS listening_lessons_insert_owner ON public.listening_lessons;
DROP POLICY IF EXISTS listening_lessons_update_owner ON public.listening_lessons;
DROP POLICY IF EXISTS listening_lessons_delete_owner ON public.listening_lessons;
DROP POLICY IF EXISTS listening_questions_select_visible ON public.listening_questions;
DROP POLICY IF EXISTS listening_questions_owner_all ON public.listening_questions;
DROP POLICY IF EXISTS listening_attempts_owner_all ON public.listening_attempts;
DROP POLICY IF EXISTS listening_audio_jobs_owner_all ON public.listening_audio_jobs;
DROP POLICY IF EXISTS toeic_tests_select_visible ON public.toeic_tests;
DROP POLICY IF EXISTS toeic_tests_owner_all ON public.toeic_tests;
DROP POLICY IF EXISTS toeic_questions_select_visible ON public.toeic_questions;
DROP POLICY IF EXISTS toeic_questions_owner_all ON public.toeic_questions;
DROP POLICY IF EXISTS toeic_attempts_owner_all ON public.toeic_attempts;
DROP POLICY IF EXISTS toeic_responses_owner_all ON public.toeic_responses;

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

CREATE POLICY deck_ratings_select_visible ON public.deck_ratings FOR SELECT
  USING (
    user_id = auth.uid ()
      OR EXISTS (
        SELECT 1
        FROM public.decks d
        WHERE d.id = deck_ratings.deck_id
          AND (d.owner_id = auth.uid () OR d.is_public)
      )
  );

CREATE POLICY deck_ratings_insert_visible ON public.deck_ratings FOR INSERT
  WITH CHECK (
    user_id = auth.uid ()
      AND EXISTS (
        SELECT 1
        FROM public.decks d
        WHERE d.id = deck_id
          AND d.is_public
      )
  );

CREATE POLICY deck_ratings_update_self ON public.deck_ratings FOR UPDATE
  USING (user_id = auth.uid ())
  WITH CHECK (
    user_id = auth.uid ()
      AND EXISTS (
        SELECT 1
        FROM public.decks d
        WHERE d.id = deck_id
          AND d.is_public
      )
  );

CREATE POLICY deck_ratings_delete_self ON public.deck_ratings FOR DELETE
  USING (user_id = auth.uid ());

CREATE POLICY deck_clones_owner_all ON public.deck_clones FOR ALL
  USING (user_id = auth.uid ())
  WITH CHECK (
    user_id = auth.uid ()
      AND EXISTS (
        SELECT 1
        FROM public.decks source_deck
        WHERE source_deck.id = source_deck_id
          AND source_deck.is_public
      )
      AND EXISTS (
        SELECT 1
        FROM public.decks cloned_deck
        WHERE cloned_deck.id = cloned_deck_id
          AND cloned_deck.owner_id = auth.uid ()
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

CREATE POLICY reading_passages_read_published ON public.reading_passages FOR SELECT
  USING (published);

CREATE POLICY reading_vocabulary_read_published_passage ON public.reading_vocabulary FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.reading_passages rp
      WHERE rp.id = reading_vocabulary.passage_id
        AND rp.published
    )
  );

CREATE POLICY reading_questions_read_published_passage ON public.reading_questions FOR SELECT
  USING (
    published
      AND EXISTS (
        SELECT 1
        FROM public.reading_passages rp
        WHERE rp.id = reading_questions.passage_id
          AND rp.published
      )
  );

CREATE POLICY reading_progress_owner_all ON public.reading_progress FOR ALL
  USING (user_id = auth.uid ())
  WITH CHECK (
    user_id = auth.uid ()
      AND EXISTS (
        SELECT 1
        FROM public.reading_passages rp
        WHERE rp.id = passage_id
          AND rp.published
      )
  );

CREATE POLICY learning_errors_owner_all ON public.learning_errors FOR ALL
  USING (user_id = auth.uid ())
  WITH CHECK (user_id = auth.uid ());

CREATE POLICY dictation_sources_owner_all ON public.dictation_sources FOR ALL
  USING (user_id = auth.uid ())
  WITH CHECK (user_id = auth.uid ());

CREATE POLICY transcript_segments_owner_all ON public.transcript_segments FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.dictation_sources ds
      WHERE ds.id = transcript_segments.source_id
        AND ds.user_id = auth.uid ()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.dictation_sources ds
      WHERE ds.id = source_id
        AND ds.user_id = auth.uid ()
    )
  );

CREATE POLICY dictation_attempts_owner_all ON public.dictation_attempts FOR ALL
  USING (user_id = auth.uid ())
  WITH CHECK (
    user_id = auth.uid ()
      AND EXISTS (
        SELECT 1
        FROM public.dictation_sources ds
        WHERE ds.id = source_id
          AND ds.user_id = auth.uid ()
      )
      AND (
        segment_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM public.transcript_segments ts
            JOIN public.dictation_sources ds ON ds.id = ts.source_id
            WHERE ts.id = segment_id
              AND ds.user_id = auth.uid ()
          )
      )
  );

CREATE POLICY dictation_error_items_owner_all ON public.dictation_error_items FOR ALL
  USING (user_id = auth.uid ())
  WITH CHECK (
    user_id = auth.uid ()
      AND EXISTS (
        SELECT 1
        FROM public.dictation_attempts da
        WHERE da.id = attempt_id
          AND da.user_id = auth.uid ()
      )
      AND (
        card_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM public.cards c
            JOIN public.decks d ON d.id = c.deck_id
            WHERE c.id = card_id
              AND d.owner_id = auth.uid ()
          )
      )
  );

CREATE POLICY shadowing_attempts_owner_all ON public.shadowing_attempts FOR ALL
  USING (user_id = auth.uid ())
  WITH CHECK (
    user_id = auth.uid ()
      AND EXISTS (
        SELECT 1
        FROM public.dictation_sources ds
        WHERE ds.id = source_id
          AND ds.user_id = auth.uid ()
      )
      AND (
        segment_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM public.transcript_segments ts
            JOIN public.dictation_sources ds ON ds.id = ts.source_id
            WHERE ts.id = segment_id
              AND ds.user_id = auth.uid ()
          )
      )
  );

CREATE POLICY shadowing_feedback_owner_all ON public.shadowing_feedback FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.shadowing_attempts sa
      WHERE sa.id = shadowing_feedback.attempt_id
        AND sa.user_id = auth.uid ()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.shadowing_attempts sa
      WHERE sa.id = attempt_id
        AND sa.user_id = auth.uid ()
    )
  );

CREATE POLICY writing_tasks_read_published ON public.writing_tasks FOR SELECT
  USING (published);

CREATE POLICY writing_submissions_owner_all ON public.writing_submissions FOR ALL
  USING (user_id = auth.uid ())
  WITH CHECK (
    user_id = auth.uid ()
      AND (
        task_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM public.writing_tasks wt
            WHERE wt.id = task_id
              AND wt.published
          )
      )
  );

CREATE POLICY writing_feedback_owner_all ON public.writing_feedback FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.writing_submissions ws
      WHERE ws.id = writing_feedback.submission_id
        AND ws.user_id = auth.uid ()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.writing_submissions ws
      WHERE ws.id = submission_id
        AND ws.user_id = auth.uid ()
    )
  );

CREATE POLICY speaking_prompts_read_published ON public.speaking_prompts FOR SELECT
  USING (published);

CREATE POLICY speaking_sessions_owner_all ON public.speaking_sessions FOR ALL
  USING (user_id = auth.uid ())
  WITH CHECK (
    user_id = auth.uid ()
      AND (
        prompt_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM public.speaking_prompts sp
            WHERE sp.id = prompt_id
              AND sp.published
          )
      )
  );

CREATE POLICY speaking_attempts_owner_all ON public.speaking_attempts FOR ALL
  USING (user_id = auth.uid ())
  WITH CHECK (
    user_id = auth.uid ()
      AND (
        session_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM public.speaking_sessions ss
            WHERE ss.id = session_id
              AND ss.user_id = auth.uid ()
          )
      )
      AND (
        prompt_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM public.speaking_prompts sp
            WHERE sp.id = prompt_id
              AND sp.published
          )
      )
  );

CREATE POLICY speaking_feedback_owner_all ON public.speaking_feedback FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.speaking_attempts sa
      WHERE sa.id = speaking_feedback.attempt_id
        AND sa.user_id = auth.uid ()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.speaking_attempts sa
      WHERE sa.id = attempt_id
        AND sa.user_id = auth.uid ()
    )
  );

CREATE POLICY speaking_drills_owner_all ON public.speaking_drills FOR ALL
  USING (user_id = auth.uid ())
  WITH CHECK (
    user_id = auth.uid ()
      AND (
        prompt_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM public.speaking_prompts sp
            WHERE sp.id = prompt_id
              AND sp.published
          )
      )
  );

CREATE POLICY listening_lessons_select_visible ON public.listening_lessons FOR SELECT
  USING (published OR owner_id = auth.uid ());

CREATE POLICY listening_lessons_insert_owner ON public.listening_lessons FOR INSERT
  WITH CHECK (
    owner_id = auth.uid ()
      AND (
        source_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM public.dictation_sources ds
            WHERE ds.id = source_id
              AND ds.user_id = auth.uid ()
          )
      )
  );

CREATE POLICY listening_lessons_update_owner ON public.listening_lessons FOR UPDATE
  USING (owner_id = auth.uid ())
  WITH CHECK (
    owner_id = auth.uid ()
      AND (
        source_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM public.dictation_sources ds
            WHERE ds.id = source_id
              AND ds.user_id = auth.uid ()
          )
      )
  );

CREATE POLICY listening_lessons_delete_owner ON public.listening_lessons FOR DELETE
  USING (owner_id = auth.uid ());

CREATE POLICY listening_questions_select_visible ON public.listening_questions FOR SELECT
  USING (
    published
      AND EXISTS (
        SELECT 1
        FROM public.listening_lessons ll
        WHERE ll.id = listening_questions.lesson_id
          AND (ll.published OR ll.owner_id = auth.uid ())
      )
  );

CREATE POLICY listening_questions_owner_all ON public.listening_questions FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.listening_lessons ll
      WHERE ll.id = listening_questions.lesson_id
        AND ll.owner_id = auth.uid ()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.listening_lessons ll
      WHERE ll.id = lesson_id
        AND ll.owner_id = auth.uid ()
    )
  );

CREATE POLICY listening_attempts_owner_all ON public.listening_attempts FOR ALL
  USING (user_id = auth.uid ())
  WITH CHECK (
    user_id = auth.uid ()
      AND EXISTS (
        SELECT 1
        FROM public.listening_lessons ll
        WHERE ll.id = lesson_id
          AND (ll.published OR ll.owner_id = auth.uid ())
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

CREATE POLICY listening_audio_jobs_owner_all ON public.listening_audio_jobs FOR ALL
  USING (
    user_id = auth.uid ()
      OR EXISTS (
        SELECT 1
        FROM public.listening_lessons ll
        WHERE ll.id = listening_audio_jobs.lesson_id
          AND ll.owner_id = auth.uid ()
      )
  )
  WITH CHECK (
    (user_id IS NULL OR user_id = auth.uid ())
      AND EXISTS (
        SELECT 1
        FROM public.listening_lessons ll
        WHERE ll.id = lesson_id
          AND (ll.owner_id = auth.uid () OR ll.published)
      )
  );

CREATE POLICY toeic_tests_select_visible ON public.toeic_tests FOR SELECT
  USING (published OR owner_id = auth.uid ());

CREATE POLICY toeic_tests_owner_all ON public.toeic_tests FOR ALL
  USING (owner_id = auth.uid ())
  WITH CHECK (owner_id = auth.uid ());

CREATE POLICY toeic_questions_select_visible ON public.toeic_questions FOR SELECT
  USING (
    published
      AND EXISTS (
        SELECT 1
        FROM public.toeic_tests tt
        WHERE tt.id = toeic_questions.test_id
          AND (tt.published OR tt.owner_id = auth.uid ())
      )
  );

CREATE POLICY toeic_questions_owner_all ON public.toeic_questions FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.toeic_tests tt
      WHERE tt.id = toeic_questions.test_id
        AND tt.owner_id = auth.uid ()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.toeic_tests tt
      WHERE tt.id = test_id
        AND tt.owner_id = auth.uid ()
    )
  );

CREATE POLICY toeic_attempts_owner_all ON public.toeic_attempts FOR ALL
  USING (user_id = auth.uid ())
  WITH CHECK (
    user_id = auth.uid ()
      AND (
        test_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM public.toeic_tests tt
            WHERE tt.id = test_id
              AND (tt.published OR tt.owner_id = auth.uid ())
          )
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

CREATE POLICY toeic_responses_owner_all ON public.toeic_responses FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.toeic_attempts ta
      WHERE ta.id = toeic_responses.attempt_id
        AND ta.user_id = auth.uid ()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.toeic_attempts ta
      WHERE ta.id = attempt_id
        AND ta.user_id = auth.uid ()
    )
  );

------------------------------------------------------------------------------
-- Seed TOEIC data.
------------------------------------------------------------------------------
INSERT INTO public.toeic_tests (
  id,
  title,
  test_mode,
  target_score,
  duration_minutes,
  sections,
  generated_by,
  metadata,
  published
)
VALUES (
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01'::uuid,
  'Demo TOEIC Mini Practice',
  'mini',
  650,
  10,
  ARRAY['reading']::public.toeic_section[],
  'seed',
  '{"description": "Short public TOEIC Part 5/7 smoke-test set."}'::jsonb,
  true
)
ON CONFLICT (id) DO UPDATE
SET
  title = EXCLUDED.title,
  test_mode = EXCLUDED.test_mode,
  target_score = EXCLUDED.target_score,
  duration_minutes = EXCLUDED.duration_minutes,
  sections = EXCLUDED.sections,
  generated_by = EXCLUDED.generated_by,
  metadata = EXCLUDED.metadata,
  published = EXCLUDED.published,
  updated_at = timezone ('utc', now());

INSERT INTO public.toeic_questions (
  id,
  test_id,
  section,
  part,
  question_number,
  prompt,
  choices,
  answer_schema,
  explanation,
  passage,
  difficulty,
  published
)
VALUES
  (
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee11'::uuid,
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01'::uuid,
    'reading'::public.toeic_section,
    5,
    1,
    'The manager asked the team to submit the report _____ Friday.',
    '["by", "at", "of", "for"]'::jsonb,
    '{"correctIndex": 0}'::jsonb,
    'By Friday means no later than Friday.',
    NULL,
    2,
    true
  ),
  (
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee12'::uuid,
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01'::uuid,
    'reading'::public.toeic_section,
    7,
    2,
    'According to the notice, why should employees update their contact information?',
    '["To receive emergency alerts", "To request vacation days", "To change departments", "To reserve meeting rooms"]'::jsonb,
    '{"correctIndex": 0}'::jsonb,
    'The notice says updated contact details help HR send emergency alerts.',
    'Company Notice: Please update your contact information by Friday so the HR team can send emergency alerts quickly.',
    2,
    true
  )
ON CONFLICT (id) DO UPDATE
SET
  test_id = EXCLUDED.test_id,
  section = EXCLUDED.section,
  part = EXCLUDED.part,
  question_number = EXCLUDED.question_number,
  prompt = EXCLUDED.prompt,
  choices = EXCLUDED.choices,
  answer_schema = EXCLUDED.answer_schema,
  explanation = EXCLUDED.explanation,
  passage = EXCLUDED.passage,
  difficulty = EXCLUDED.difficulty,
  published = EXCLUDED.published,
  updated_at = timezone ('utc', now());

------------------------------------------------------------------------------
-- Seed listening data.
------------------------------------------------------------------------------
INSERT INTO public.listening_lessons (
  id,
  title,
  topic,
  level,
  content_kind,
  transcript_text,
  dialogue,
  audio_metadata,
  published
)
VALUES (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01'::uuid,
  'Demo - planning a study routine',
  'daily study habits',
  'B1'::public.cefr_level,
  'dialogue'::public.listening_content_kind,
  'Mia: I want to improve my English, but I only have twenty minutes a day. Leo: That is enough if you choose one clear task. Try ten minutes of listening and ten minutes of flashcards. Mia: Should I study new words every day? Leo: Yes, but review old words first so you do not forget them.',
  '[
    {"speaker": "Mia", "text": "I want to improve my English, but I only have twenty minutes a day."},
    {"speaker": "Leo", "text": "That is enough if you choose one clear task. Try ten minutes of listening and ten minutes of flashcards."},
    {"speaker": "Mia", "text": "Should I study new words every day?"},
    {"speaker": "Leo", "text": "Yes, but review old words first so you do not forget them."}
  ]'::jsonb,
  '{"provider": "seed", "ttsStatus": "not_generated"}'::jsonb,
  true
)
ON CONFLICT (id) DO UPDATE
SET
  title = EXCLUDED.title,
  topic = EXCLUDED.topic,
  level = EXCLUDED.level,
  content_kind = EXCLUDED.content_kind,
  transcript_text = EXCLUDED.transcript_text,
  dialogue = EXCLUDED.dialogue,
  audio_metadata = EXCLUDED.audio_metadata,
  published = EXCLUDED.published;

INSERT INTO public.listening_questions (
  id,
  lesson_id,
  question_type,
  prompt,
  choices,
  answer,
  explanation,
  skill_focus,
  position,
  published
)
VALUES
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb11'::uuid,
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01'::uuid,
    'mcq',
    'How much time does Mia have each day?',
    '["Ten minutes", "Twenty minutes", "One hour", "Only weekends"]'::jsonb,
    '{"correctIndex": 1}'::jsonb,
    'Mia says she only has twenty minutes a day.',
    'detail',
    0,
    true
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb12'::uuid,
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01'::uuid,
    'true_false',
    'Leo suggests reviewing old words before studying new words.',
    '["True", "False"]'::jsonb,
    '{"correctIndex": 0}'::jsonb,
    'Leo says to review old words first so Mia does not forget them.',
    'inference',
    1,
    true
  )
ON CONFLICT (id) DO UPDATE
SET
  lesson_id = EXCLUDED.lesson_id,
  question_type = EXCLUDED.question_type,
  prompt = EXCLUDED.prompt,
  choices = EXCLUDED.choices,
  answer = EXCLUDED.answer,
  explanation = EXCLUDED.explanation,
  skill_focus = EXCLUDED.skill_focus,
  position = EXCLUDED.position,
  published = EXCLUDED.published;

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

------------------------------------------------------------------------------
-- M7 seed reading data
------------------------------------------------------------------------------
INSERT INTO public.reading_passages (
  id,
  title,
  slug,
  cefr_level,
  topic,
  body,
  source_url,
  estimated_minutes,
  published
)
VALUES (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01'::uuid,
  'Why Small Habits Matter',
  'why-small-habits-matter',
  'B1'::public.cefr_level,
  'productivity',
  'Small habits look simple, but they can change the direction of a learner''s progress. A student who reads one short article every morning may not feel different after a single day. However, after several weeks, the student has met hundreds of useful words in context. The habit also reduces friction: instead of deciding when to study, the learner already has a routine. Good systems make useful actions easier to repeat. For language learning, a small daily habit is often more reliable than a long study session that happens only once in a while.',
  NULL,
  5,
  true
)
ON CONFLICT (id) DO UPDATE
SET
  title = EXCLUDED.title,
  slug = EXCLUDED.slug,
  cefr_level = EXCLUDED.cefr_level,
  topic = EXCLUDED.topic,
  body = EXCLUDED.body,
  source_url = EXCLUDED.source_url,
  estimated_minutes = EXCLUDED.estimated_minutes,
  published = EXCLUDED.published,
  updated_at = timezone ('utc', now());

INSERT INTO public.reading_vocabulary (
  id,
  passage_id,
  term,
  definition,
  example,
  cefr_level,
  position_start,
  position_end
)
VALUES
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb11'::uuid,
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01'::uuid,
    'friction',
    'Difficulty or resistance that makes an action harder to start or repeat.',
    'Preparing your notebook at night reduces friction in the morning.',
    'B2'::public.cefr_level,
    NULL,
    NULL
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb12'::uuid,
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01'::uuid,
    'reliable',
    'Something that can be trusted to work well or happen consistently.',
    'A small daily habit is more reliable than a rare long session.',
    'B1'::public.cefr_level,
    NULL,
    NULL
  )
ON CONFLICT (id) DO UPDATE
SET
  passage_id = EXCLUDED.passage_id,
  term = EXCLUDED.term,
  definition = EXCLUDED.definition,
  example = EXCLUDED.example,
  cefr_level = EXCLUDED.cefr_level,
  position_start = EXCLUDED.position_start,
  position_end = EXCLUDED.position_end,
  updated_at = timezone ('utc', now());

INSERT INTO public.reading_questions (
  id,
  passage_id,
  question_type,
  prompt,
  choices,
  answer_schema,
  explanation,
  difficulty,
  position,
  published
)
VALUES
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb21'::uuid,
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01'::uuid,
    'mcq',
    'What is the main idea of the passage?',
    '[
      "Small habits can support steady language learning.",
      "Long study sessions are always better than short ones.",
      "Reading every morning immediately changes a learner.",
      "Vocabulary should be learned only from lists."
    ]'::jsonb,
    '{"correctIndex": 0}'::jsonb,
    'The passage argues that small repeated actions create progress over time.',
    2,
    1,
    true
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb22'::uuid,
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01'::uuid,
    'mcq',
    'In the passage, what does reducing friction mean?',
    '[
      "Making study easier to start and repeat.",
      "Making articles more difficult.",
      "Removing all vocabulary from context.",
      "Studying only when motivation is high."
    ]'::jsonb,
    '{"correctIndex": 0}'::jsonb,
    'The passage says routines reduce friction because the learner does not need to decide when to study.',
    2,
    2,
    true
  )
ON CONFLICT (id) DO UPDATE
SET
  passage_id = EXCLUDED.passage_id,
  question_type = EXCLUDED.question_type,
  prompt = EXCLUDED.prompt,
  choices = EXCLUDED.choices,
  answer_schema = EXCLUDED.answer_schema,
  explanation = EXCLUDED.explanation,
  difficulty = EXCLUDED.difficulty,
  position = EXCLUDED.position,
  published = EXCLUDED.published,
  updated_at = timezone ('utc', now());

------------------------------------------------------------------------------
-- M10 seed writing data
------------------------------------------------------------------------------
INSERT INTO public.writing_tasks (
  id,
  title,
  task_type,
  prompt,
  cefr_level,
  target_cert,
  time_limit_minutes,
  min_words,
  max_words,
  rubric,
  sample_answer,
  published
)
VALUES (
  'cccccccc-cccc-4ccc-8ccc-cccccccccc01'::uuid,
  'Opinion essay - daily habits',
  'opinion_essay',
  'Some people believe that small daily habits are more effective for language learning than occasional long study sessions. To what extent do you agree or disagree?',
  'B1'::public.cefr_level,
  'IELTS'::public.target_cert,
  40,
  180,
  320,
  '{
    "criteria": [
      {"name": "Task Achievement", "max": 25},
      {"name": "Coherence and Cohesion", "max": 25},
      {"name": "Lexical Resource", "max": 25},
      {"name": "Grammatical Range and Accuracy", "max": 25}
    ]
  }'::jsonb,
  NULL,
  true
)
ON CONFLICT (id) DO UPDATE
SET
  title = EXCLUDED.title,
  task_type = EXCLUDED.task_type,
  prompt = EXCLUDED.prompt,
  cefr_level = EXCLUDED.cefr_level,
  target_cert = EXCLUDED.target_cert,
  time_limit_minutes = EXCLUDED.time_limit_minutes,
  min_words = EXCLUDED.min_words,
  max_words = EXCLUDED.max_words,
  rubric = EXCLUDED.rubric,
  sample_answer = EXCLUDED.sample_answer,
  published = EXCLUDED.published,
  updated_at = timezone ('utc', now());

------------------------------------------------------------------------------
-- M11 seed speaking data
------------------------------------------------------------------------------
INSERT INTO public.speaking_prompts (
  id,
  title,
  prompt_type,
  prompt,
  cefr_level,
  target_cert,
  topic,
  expected_duration_seconds,
  rubric,
  sample_answer,
  published
)
VALUES (
  'dddddddd-dddd-4ddd-8ddd-dddddddddd01'::uuid,
  'Describe a useful daily habit',
  'short_answer',
  'Describe one small daily habit that helps you learn English. Explain why it is useful and how often you do it.',
  'B1'::public.cefr_level,
  'COMMUNICATION'::public.target_cert,
  'habits',
  90,
  '{
    "criteria": [
      {"name": "Pronunciation", "max": 25},
      {"name": "Fluency", "max": 25},
      {"name": "Vocabulary Range", "max": 25},
      {"name": "Coherence", "max": 25}
    ]
  }'::jsonb,
  NULL,
  true
)
ON CONFLICT (id) DO UPDATE
SET
  title = EXCLUDED.title,
  prompt_type = EXCLUDED.prompt_type,
  prompt = EXCLUDED.prompt,
  cefr_level = EXCLUDED.cefr_level,
  target_cert = EXCLUDED.target_cert,
  topic = EXCLUDED.topic,
  expected_duration_seconds = EXCLUDED.expected_duration_seconds,
  rubric = EXCLUDED.rubric,
  sample_answer = EXCLUDED.sample_answer,
  published = EXCLUDED.published,
  updated_at = timezone ('utc', now());
