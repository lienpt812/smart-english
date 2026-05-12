import type { Pool } from "pg";

export async function insertRefreshToken(
  pool: Pool,
  userId: string,
  tokenHash: string,
  expiresAt: Date
): Promise<void> {
  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt]
  );
}

export type RefreshRow = { user_id: string };

/** Đọc và xóa refresh token hợp lệ (single-use rotation). */
export async function consumeRefreshToken(
  pool: Pool,
  tokenHash: string
): Promise<RefreshRow | null> {
  const result = await pool.query<RefreshRow>(
    `DELETE FROM refresh_tokens
     WHERE token_hash = $1 AND expires_at > now()
     RETURNING user_id`,
    [tokenHash]
  );
  return result.rows[0] ?? null;
}

/** Thu hồi một phiên đăng nhập (logout). */
export async function revokeRefreshToken(
  pool: Pool,
  tokenHash: string
): Promise<void> {
  await pool.query(`DELETE FROM refresh_tokens WHERE token_hash = $1`, [
    tokenHash,
  ]);
}
