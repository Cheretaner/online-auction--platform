import { logger } from "../../shared/utils/logger.js";
import { pruneExpiredIdempotencyKeys } from "../../shared/utils/idempotency.js";
import { processNotificationQueue, processOutboxBatch } from "../outbox/outbox.dispatcher.js";

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
  scheduleJob({
    name: "idempotency-prune",
    intervalMs: 5 * 60 * 1000,
    run: () => {
      pruneExpiredIdempotencyKeys();
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
      await processOutboxBatch();
    },
  });

  // Safety net for notifications whose first attempt failed (e.g. SMTP
  // briefly unavailable); retries with backoff via next_attempt_at.
  scheduleJob({
    name: "notification-retry",
    intervalMs: 60 * 1000,
    run: async () => {
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
