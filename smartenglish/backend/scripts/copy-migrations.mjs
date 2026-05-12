/**
 * Sao chép file .sql từ src/db/migrations → dist/db/migrations (tsc không copy file không phải .ts).
 */
import { mkdirSync, readdirSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const backendRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const srcDir = join(backendRoot, "src", "db", "migrations");
const destDir = join(backendRoot, "dist", "db", "migrations");

mkdirSync(destDir, { recursive: true });

for (const name of readdirSync(srcDir)) {
  if (!name.endsWith(".sql")) continue;
  copyFileSync(join(srcDir, name), join(destDir, name));
}
