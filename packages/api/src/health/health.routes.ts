import { Router } from "express";
import { env } from "../config/env.js";
import { pingDatabase } from "../infrastructure/database/pool.js";
import { criticalJobHealth } from "../infrastructure/scheduler/scheduler.js";
import { HttpStatus } from "../shared/errors/index.js";
import { asyncHandler } from "../shared/middleware/asyncHandler.js";

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

    try {
      const ok = await pingDatabase();
      const jobs = criticalJobHealth();
      const jobsOk = Object.values(jobs).every((job) => job.healthy);
      const ready = ok && jobsOk;
      res.status(ready ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE).json({
        status: ready ? "ready" : "not_ready",
        database: ok ? "up" : "down",
        jobs,
      });
    } catch {
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        status: "not_ready",
        database: "down",
      });
    }
  }),
);
