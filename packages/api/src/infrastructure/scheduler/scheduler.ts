type ScheduledJob = {
  name: string;
  intervalMs: number;
  run: () => Promise<void> | void;
};

const timers = new Map<string, NodeJS.Timeout>();

export function scheduleJob(job: ScheduledJob): void {
  if (timers.has(job.name)) return;
  const timer = setInterval(async () => {
    try {
      await job.run();
    } catch {
      // Jobs should log internally; keep scheduler resilient.
    }
  }, job.intervalMs);
  timers.set(job.name, timer);
}

export function stopAllJobs(): void {
  for (const timer of timers.values()) {
    clearInterval(timer);
  }
  timers.clear();
}
