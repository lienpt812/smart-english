import { existsSync, readFileSync, readdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import { pool } from "./pool.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function resolveMigrationsDir(): string {
  const nextToCompiled = join(__dirname, "migrations");
  if (existsSync(nextToCompiled)) return nextToCompiled;

  const fromRepo = join(process.cwd(), "src", "db", "migrations");
  if (existsSync(fromRepo)) return fromRepo;

  throw new Error(
    `Không tìm thấy thư mục migrations (.sql). Đã thử:\n  - ${nextToCompiled}\n  - ${fromRepo}\n` +
      "Chạy lại npm run build (copy .sql vào dist) hoặc chạy backend từ thư mục repo."
  );
}

export async function runMigrations(): Promise<void> {
  if (!pool) {
    console.warn("Skipping migrations: DATABASE_URL unset");
    return;
  }
  const dir = resolveMigrationsDir();
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const client = await pool.connect();
  try {
    for (const file of files) {
      const sql = readFileSync(join(dir, file), "utf8");
      await client.query(sql);
      console.log(`Migration applied: ${file}`);
    }
  } finally {
    client.release();
  }
}
