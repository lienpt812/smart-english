import pg from "pg";

export const pool = process.env.DATABASE_URL
  ? new pg.Pool({ connectionString: process.env.DATABASE_URL })
  : null;

export function requirePool(): pg.Pool {
  if (!pool) {
    throw Object.assign(new Error("DATABASE_URL chưa được cấu hình"), {
      statusCode: 503,
    });
  }
  return pool;
}
