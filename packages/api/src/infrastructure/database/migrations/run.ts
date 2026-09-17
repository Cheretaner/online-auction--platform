import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

import { closePool, getPool } from "../pool.js";
import { logger } from "../../../shared/utils/logger.js";

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

interface Migration {
  id: string;
  filename: string;
  sql: string;
}

function loadMigrations(): Migration[] {
  return readdirSync(__dirname)
    .filter(
      (file) =>
        file.endsWith(".sql") &&
        !file.endsWith(".down.sql"),
    )
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

async function runMigrations(): Promise<void> {
  const pool = getPool();

  await ensureMigrationTable();

  const migrations = loadMigrations();

  const appliedResult = await pool.query<{ id: string }>(
    `
      SELECT id
      FROM schema_migrations
      ORDER BY id
    `,
  );

  const appliedIds = new Set(
    appliedResult.rows.map((row) => row.id),
  );

  for (const migration of migrations) {
    if (appliedIds.has(migration.id)) {
      logger.info(
        { file: migration.filename },
        "Migration already applied",
      );

      continue;
    }

    const client = await pool.connect();

    try {
      logger.info(
        { file: migration.filename },
        "Applying migration",
      );

      await client.query("BEGIN");

      await client.query(migration.sql);

      await client.query(
        `
          INSERT INTO schema_migrations (id)
          VALUES ($1)
        `,
        [migration.id],
      );

      await client.query("COMMIT");

      logger.info(
        { file: migration.filename },
        "Migration applied",
      );
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        logger.error(
          {
            err: rollbackError,
            migration: migration.filename,
          },
          "Migration rollback failed",
        );
      }

      throw error;
    } finally {
      client.release();
    }
  }

  logger.info(
    { count: migrations.length },
    "Migrations complete",
  );
}

runMigrations()
  .catch((error) => {
    logger.error(
      { err: error },
      "Migration failed",
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });