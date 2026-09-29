// tsc only emits JavaScript, but the migration runner reads the .sql files
// next to its own compiled location. Copy them into dist so `node dist/...`
// (and RUN_MIGRATIONS_ON_BOOT) finds every migration.
import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "src/infrastructure/database/migrations");
const to = join(root, "dist/infrastructure/database/migrations");

mkdirSync(to, { recursive: true });
const files = readdirSync(from).filter((file) => file.endsWith(".sql"));
for (const file of files) copyFileSync(join(from, file), join(to, file));
console.log(`copied ${files.length} migration files to dist`);
