import { Router } from "express";
import { env } from "../config/env.js";
import { pingDatabase } from "../infrastructure/database/pool.js";
import { HttpStatus } from "../shared/errors/index.js";
import { asyncHandler } from "../shared/middleware/asyncHandler.js";

import { getSchedulerHealth } from "../infrastructure/scheduler/scheduler.js";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  res.json({
    status: "ok",
    service: "@auction/api",
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

healthRouter.get(
  "/ready",
  asyncHandler(async (_req, res) => {
    if (!env.DATABASE_URL) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        status: "not_ready",
        database: "unconfigured",
      });
      return;
    }

    const schedulerHealth = getSchedulerHealth();

    try {
      const ok = await pingDatabase();
      const isReady = ok && schedulerHealth.healthy;
      res.status(isReady ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE).json({
        status: isReady ? "ready" : "not_ready",
        database: ok ? "up" : "down",
        scheduler: schedulerHealth,
      });
    } catch {
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        status: "not_ready",
        database: "down",
        scheduler: schedulerHealth,
      });
    }
  }),
);
