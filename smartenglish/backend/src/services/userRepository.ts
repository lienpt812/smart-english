import type { Pool } from "pg";

import type { GoogleProfile } from "./googleAuth.js";

export type UserRow = {
  id: string;
  google_sub: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  locale: string;
  placement_completed: boolean;
  placement_skipped: boolean;
  created_at: Date;
  updated_at: Date;
};

export type UserStatsRow = {
  user_id: string;
  skill_listening: number | null;
  skill_speaking: number | null;
  skill_reading: number | null;
  skill_writing: number | null;
  streak_current: number;
  streak_longest: number;
  srs_due_today: number;
  srs_new_cards: number;
  roadmap_completed_pct: number;
  next_milestone: string | null;
  updated_at: Date;
};

export async function upsertUserFromGoogle(
  pool: Pool,
  profile: GoogleProfile
): Promise<UserRow> {
  const result = await pool.query<UserRow>(
    `INSERT INTO users (google_sub, email, display_name, avatar_url)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (google_sub) DO UPDATE SET
       email = EXCLUDED.email,
       display_name = COALESCE(EXCLUDED.display_name, users.display_name),
       avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
       updated_at = now()
     RETURNING *`,
    [
      profile.googleSub,
      profile.email,
      profile.displayName,
      profile.avatarUrl,
    ]
  );
  const row = result.rows[0];
  if (!row) throw new Error("Không thể tạo/cập nhật người dùng");
  return row;
}

export async function ensureUserStats(pool: Pool, userId: string): Promise<void> {
  await pool.query(
    `INSERT INTO user_stats (user_id) VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );
}

export async function findUserById(
  pool: Pool,
  userId: string
): Promise<UserRow | null> {
  const result = await pool.query<UserRow>(
    `SELECT * FROM users WHERE id = $1`,
    [userId]
  );
  return result.rows[0] ?? null;
}

export async function findUserStats(
  pool: Pool,
  userId: string
): Promise<UserStatsRow | null> {
  const result = await pool.query<UserStatsRow>(
    `SELECT * FROM user_stats WHERE user_id = $1`,
    [userId]
  );
  return result.rows[0] ?? null;
}

export type UserPatch = {
  locale?: string;
  placementCompleted?: boolean;
  placementSkipped?: boolean;
};

export async function updateUserProfile(
  pool: Pool,
  userId: string,
  patch: UserPatch
): Promise<UserRow | null> {
  const sets: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  if (patch.locale !== undefined) {
    sets.push(`locale = $${i++}`);
    values.push(patch.locale);
  }
  if (patch.placementCompleted !== undefined) {
    sets.push(`placement_completed = $${i++}`);
    values.push(patch.placementCompleted);
  }
  if (patch.placementSkipped !== undefined) {
    sets.push(`placement_skipped = $${i++}`);
    values.push(patch.placementSkipped);
  }

  if (sets.length === 0) {
    return findUserById(pool, userId);
  }

  sets.push(`updated_at = now()`);
  values.push(userId);

  const result = await pool.query<UserRow>(
    `UPDATE users SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`,
    values
  );
  return result.rows[0] ?? null;
}
