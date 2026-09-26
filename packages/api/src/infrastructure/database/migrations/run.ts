import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { closePool, getPool } from "../pool.js";
import { logger } from "../../../shared/utils/logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface Migration {
  id: string;
  filename: string;
  sql: string;
}

function loadMigrations(): Migration[] {
  return readdirSync(__dirname)
    .filter((file) => file.endsWith(".up.sql"))
    .sort()
    .map((filename) => ({
      id: filename,
      filename,
      sql: readFileSync(join(__dirname, filename), "utf8"),
    }));
}

async function ensureMigrationTable(): Promise<void> {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

/**
 * Applies pending migrations.
 * Returns the number of migrations that were newly applied.
 */
/** Arbitrary constant key for the migration advisory lock. */
const MIGRATION_LOCK_KEY = 7_311_842_001;

/**
 * Applies pending migrations.
 * Returns the number of migrations that were newly applied.
 *
 * Holds a session-level advisory lock for the whole run, so two processes
 * starting at once (several API instances with RUN_MIGRATIONS_ON_BOOT, or a
 * deploy step racing a booting server) apply each migration exactly once
 * instead of failing half-way with duplicate-object errors.
 */
export async function runMigrations(): Promise<number> {
  const pool = getPool();
  const lockClient = await pool.connect();

  try {
    await lockClient.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_KEY]);
    return await applyPendingMigrations();
  } finally {
    try {
      await lockClient.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_KEY]);
    } finally {
      lockClient.release();
    }
  }
}

async function applyPendingMigrations(): Promise<number> {
  const pool = getPool();

  await ensureMigrationTable();

  const migrations = loadMigrations();

  const appliedResult = await pool.query<{ id: string }>(`
    SELECT id
    FROM schema_migrations
    ORDER BY id
  `);

  const appliedIds = new Set(appliedResult.rows.map((row) => row.id));
  let newlyApplied = 0;

  for (const migration of migrations) {
    if (appliedIds.has(migration.id)) {
      logger.debug({ file: migration.filename }, "Migration already applied");
      continue;
    }

    const client = await pool.connect();

    try {
      logger.info({ file: migration.filename }, "Applying migration");

      await client.query("BEGIN");
      await client.query(migration.sql);
      await client.query(
        `INSERT INTO schema_migrations (id) VALUES ($1)`,
        [migration.id],
      );
      await client.query("COMMIT");

      newlyApplied++;
      logger.info({ file: migration.filename }, "Migration applied");
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        logger.error(
          { err: rollbackError, migration: migration.filename },
          "Migration rollback failed",
        );
      }

      logger.error(
        { err: error, migration: migration.filename },
        "Migration failed",
      );
      throw error;
    } finally {
      client.release();
    }
  }

  logger.info(
    { discovered: migrations.length, applied: newlyApplied },
    "Migrations complete",
  );

  return newlyApplied;
}

// Only auto-run when this file is executed directly (CLI),
// not when it is imported by the server.
const isDirectRun =
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith("run.ts") ||
    process.argv[1].endsWith("run.js") ||
    process.argv[1].includes("migrations/run"));

if (isDirectRun) {
  runMigrations()
    .catch((error) => {
      logger.error({ err: error }, "Migration runner failed");
      process.exitCode = 1;
    })
    .finally(async () => {
      await closePool();
    });
}