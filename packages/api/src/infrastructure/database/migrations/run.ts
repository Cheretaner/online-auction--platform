import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { closePool, getPool } from "../pool.js";
import { logger } from "../../../shared/utils/logger.js";

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

async function runMigrations(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const applied = await pool.query<{ id: string }>("SELECT id FROM schema_migrations");
  const appliedIds = new Set(applied.rows.map((row) => row.id));

  const files = readdirSync(__dirname)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (appliedIds.has(file)) continue;
    const sql = readFileSync(join(__dirname, file), "utf8");
    logger.info({ file }, "Applying migration");
    await pool.query("BEGIN");
    try {
      await pool.query(sql);
      await pool.query("INSERT INTO schema_migrations (id) VALUES ($1)", [file]);
      await pool.query("COMMIT");
    } catch (error) {
      await pool.query("ROLLBACK");
      throw error;
    }
  }

  logger.info("Migrations complete");
}

runMigrations()
  .catch((error) => {
    logger.error({ err: error }, "Migration failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
