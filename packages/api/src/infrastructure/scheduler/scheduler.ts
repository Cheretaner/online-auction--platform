import { env } from "../../config/env.js";
import { logger } from "../../shared/utils/logger.js";
import { pruneExpiredIdempotencyKeys } from "../../shared/utils/idempotency.js";
import { pruneExpiredIdempotencyKeys as pruneIdempotencyRows } from "../idempotency/idempotency.repository.js";
import { processNotificationQueue, processOutboxBatch } from "../outbox/outbox.dispatcher.js";
import { closeDueAuctions, openDueAuctions } from "../../auction/auction.service.js";
import { getPool } from "../database/pool.js";
import { pruneExpiredRefreshTokens } from "../../identity/session.repository.js";
import { registerAutofetchJobs, setScheduleJobFn } from "../../autofetch/autofetch.scheduler.js";

type ScheduledJob = {
  name: string;
  intervalMs: number;
  runOnStart?: boolean;
  run: () => Promise<void> | void;
};

const timers = new Map<string, NodeJS.Timeout>();

export function scheduleJob(job: ScheduledJob): void {
  if (timers.has(job.name)) return;

  const execute = async (): Promise<void> => {
    const started = Date.now();
    try {
      await job.run();
      logger.debug({ job: job.name, ms: Date.now() - started }, "Scheduled job completed");
    } catch (error) {
      logger.error({ err: error, job: job.name }, "Scheduled job failed");
    }
  };

  const timer = setInterval(() => {
    void execute();
  }, job.intervalMs);
  timer.unref();
  timers.set(job.name, timer);

  if (job.runOnStart) {
    void execute();
  }
}

export function startInfrastructureJobs(): void {
  // Register autofetch jobs (must come before scheduleJob calls)
  try {
    const pool = getPool();
    if (pool) {
      // Use a static ESM import. `require` is unavailable in this package's
      // NodeNext/"type": "module" runtime and previously prevented every
      // auto-fetch job from registering at startup.
      setScheduleJobFn(scheduleJob);
      registerAutofetchJobs(pool);
      logger.debug("AutoFetch jobs registered");
    }
  } catch (error) {
    logger.warn({ err: error }, "Could not register autofetch jobs");
  }

  scheduleJob({
    name: "idempotency-prune",
    intervalMs: 5 * 60 * 1000,
    run: async () => {
      // Both stores need pruning: the in-process cache and the durable
      // idempotency_keys table. Only the first was being swept, so the
      // table grew without bound.
      pruneExpiredIdempotencyKeys();
      if (env.DATABASE_URL) {
        await pruneIdempotencyRows();
        await pruneExpiredRefreshTokens();
      }
    },
  });

  // Auction lifecycle. Nothing else moves an auction from scheduled to live
  // or from live to closed, so without this job an approved auction never
  // opens and a finished auction never produces a winner.
  scheduleJob({
    name: "auction-lifecycle",
    intervalMs: env.AUCTION_TICK_MS,
    runOnStart: true,
    run: async () => {
      if (!env.DATABASE_URL) return;
      const now = new Date();
      const opened = await openDueAuctions(now);
      const closed = await closeDueAuctions(now);
      if (opened > 0 || closed > 0) {
        logger.info({ opened, closed }, "Auction lifecycle tick");
      }
    },
  });

  // Drains the transactional outbox: realtime broadcast (bids, extensions,
  // disputes, anomaly flags, reports, ...) and near-real-time notification
  // dispatch. Short interval - this is the only thing that turns
  // `enqueueOutbox(...)` calls into actual delivered events.
  scheduleJob({
    name: "outbox-dispatch",
    intervalMs: 2 * 1000,
    runOnStart: true,
    run: async () => {
      if (!env.DATABASE_URL) return;
      await processOutboxBatch();
    },
  });

  // Safety net for notifications whose first attempt failed (e.g. SMTP
  // briefly unavailable); retries with backoff via next_attempt_at.
  scheduleJob({
    name: "notification-retry",
    intervalMs: 60 * 1000,
    run: async () => {
      if (!env.DATABASE_URL) return;
      await processNotificationQueue();
    },
  });
}

export function stopAllJobs(): void {
  for (const timer of timers.values()) {
    clearInterval(timer);
  }
  timers.clear();
}
