import { logger } from "../../shared/utils/logger.js";
import { pruneExpiredIdempotencyKeys } from "../../shared/utils/idempotency.js";

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
}

export function stopAllJobs(): void {
  for (const timer of timers.values()) {
    clearInterval(timer);
  }
  timers.clear();
}
