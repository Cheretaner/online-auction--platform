import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { closePool, pingDatabase } from "./infrastructure/database/pool.js";
import { runMigrations } from "./infrastructure/database/migrations/run.js";
import { startInfrastructureJobs, stopAllJobs } from "./infrastructure/scheduler/scheduler.js";
import { telegramService } from "./telegram/telegram.service.js";
import { logger } from "./shared/utils/logger.js";

// A rejected promise that nobody handles used to terminate the process
// silently under Node's default policy. Log it and keep serving.
process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "Unhandled promise rejection");
});

process.on("uncaughtException", (error) => {
  logger.fatal({ err: error }, "Uncaught exception, shutting down");
  process.exit(1);
});

async function main(): Promise<void> {
  if (env.DATABASE_URL) {
    try {
      await pingDatabase();
      logger.info("Database connection established");

      if (env.RUN_MIGRATIONS_ON_BOOT) {
        // Safe under a rolling deploy: runMigrations takes a Postgres
        // advisory lock, so concurrent instances queue rather than collide.
        const applied = await runMigrations();
        logger.info({ applied }, "Boot migrations complete");
      }
    } catch (error) {
      logger.error({ err: error }, "Database is unreachable at startup");
      // Fail fast in production: a booting API that cannot reach its
      // database will pass a naive liveness probe and serve nothing but
      // 500s. /health/ready reports the truth for orchestrators.
      if (env.NODE_ENV === "production") {
        process.exit(1);
      }
    }
  } else {
    logger.warn("DATABASE_URL is not set — database-backed routes will fail");
  }

  const app = createApp();
  startInfrastructureJobs();
  await telegramService.start();

  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, "API server listening");
  });

  let shuttingDown = false;

  function shutdown(signal: string): void {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "Shutting down");

    // Stop background work first so no job starts a transaction while the
    // pool is closing.
    stopAllJobs();
    void telegramService.stop().catch(() => undefined);

    server.close(async () => {
      await closePool().catch(() => undefined);
      logger.info("Shutdown complete");
      process.exit(0);
    });

    // Don't let a hung in-flight request block the deploy indefinitely.
    const force = setTimeout(() => {
      logger.warn("Forcing shutdown after timeout");
      process.exit(1);
    }, 10_000);
    force.unref();
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

void main();
