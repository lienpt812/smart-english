CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS backend_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_sub TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  locale TEXT NOT NULL DEFAULT 'vi',
  placement_completed BOOLEAN NOT NULL DEFAULT FALSE,
  placement_skipped BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_stats (
  user_id UUID PRIMARY KEY REFERENCES backend_users (id) ON DELETE CASCADE,
  skill_listening SMALLINT,
  skill_speaking SMALLINT,
  skill_reading SMALLINT,
  skill_writing SMALLINT,
  streak_current INT NOT NULL DEFAULT 0,
  streak_longest INT NOT NULL DEFAULT 0,
  srs_due_today INT NOT NULL DEFAULT 0,
  srs_new_cards INT NOT NULL DEFAULT 0,
  roadmap_completed_pct SMALLINT NOT NULL DEFAULT 0,
  next_milestone TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT skill_listening_range CHECK (skill_listening IS NULL OR skill_listening BETWEEN 0 AND 100),
  CONSTRAINT skill_speaking_range CHECK (skill_speaking IS NULL OR skill_speaking BETWEEN 0 AND 100),
  CONSTRAINT skill_reading_range CHECK (skill_reading IS NULL OR skill_reading BETWEEN 0 AND 100),
  CONSTRAINT skill_writing_range CHECK (skill_writing IS NULL OR skill_writing BETWEEN 0 AND 100),
  CONSTRAINT roadmap_pct_range CHECK (roadmap_completed_pct BETWEEN 0 AND 100)
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES backend_users (id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_exp ON refresh_tokens (expires_at);
