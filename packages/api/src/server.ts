import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { closePool } from "./infrastructure/database/pool.js";
import { stopAllJobs } from "./infrastructure/scheduler/scheduler.js";
import { logger } from "./shared/utils/logger.js";

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, "API server listening");
});

function shutdown(signal: string): void {
  logger.info({ signal }, "Shutting down");
  server.close(async () => {
    stopAllJobs();
    await closePool().catch(() => undefined);
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

export default app;
