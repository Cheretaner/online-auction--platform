/**
 * AutoFetch Scheduler
 * Background jobs for periodic re-fetching and maintenance
 * Registered with the infrastructure scheduler at app startup
 */

import type { Pool } from 'pg';
import { logger } from '../shared/utils/logger.js';
import { AutoFetchService } from './autofetch.service.js';
import { AutoFetchRepository } from './autofetch.repository.js';

type ScheduledJob = {
  name: string;
  intervalMs: number;
  runOnStart?: boolean;
  run: () => Promise<void> | void;
};

// Dynamically import scheduleJob (defined in scheduler.ts to avoid circular dependency)
let scheduleJobFn: ((job: ScheduledJob) => void) | null = null;

export function setScheduleJobFn(fn: (job: ScheduledJob) => void): void {
  scheduleJobFn = fn;
}

export function registerAutofetchJobs(pool: Pool): void {
  if (!scheduleJobFn) {
    logger.warn('scheduleJob function not available, autofetch jobs not registered');
    return;
  }

  const service = new AutoFetchService(pool);
  const repo = new AutoFetchRepository(pool);

  /**
   * Refetch Sources Job
   * Runs every 1 hour (configurable)
   * Fetches from all active sources that are due for refetch
   */
  registerRefetchJob(service, repo);

  /**
   * Maintenance Job
   * Runs daily (every 24 hours)
   * Expires old pending items, cleans up stale data
   */
  registerMaintenanceJob(service);
}

/**
 * Job: Refetch from active sources
 * Interval: 1 hour
 * Behavior: Fetch from sources where next_fetch_at <= NOW()
 */
function registerRefetchJob(service: AutoFetchService, repo: AutoFetchRepository): void {
  const jobName = 'autofetch-refetch-sources';
  const intervalMs = 60 * 60 * 1000; // 1 hour

  if (!scheduleJobFn) return;

  scheduleJobFn({
    name: jobName,
    intervalMs,
    runOnStart: false, // Don't fetch on startup, wait for first interval
    run: async () => {
      try {
        logger.debug({ event: 'autofetch:refetch_job_started' });

        const sources = await repo.getSourcesDueForRefetch();

        if (sources.length === 0) {
          logger.debug({ event: 'autofetch:refetch_job_no_sources' });
          return;
        }

        logger.info({
          event: 'autofetch:refetch_job_processing',
          sourceCount: sources.length,
        });

        const results = {
          success: 0,
          failed: 0,
          queued: 0,
          conflicts: 0,
        };

        for (const source of sources) {
          try {
            const { queued, conflicts } = await service.fetchAndQueue(
              source.id,
              source.organizationId
            );

            results.success++;
            results.queued += queued;
            results.conflicts += conflicts;

            logger.info({
              event: 'autofetch:refetch_completed',
              sourceId: source.id,
              sourceName: source.name,
              queued,
              conflicts,
            });
          } catch (error) {
            results.failed++;
            logger.error({
              event: 'autofetch:refetch_failed',
              sourceId: source.id,
              sourceName: source.name,
              error,
            });
          }
        }

        logger.info({
          event: 'autofetch:refetch_job_completed',
          ...results,
        });
      } catch (error) {
        logger.error({
          event: 'autofetch:refetch_job_error',
          error,
        });
      }
    },
  });
}

/**
 * Job: Maintenance tasks
 * Interval: 24 hours
 * Behavior: Expire old pending items (60+ days), clean up stale data
 */
function registerMaintenanceJob(service: AutoFetchService): void {
  const jobName = 'autofetch-maintenance';
  const intervalMs = 24 * 60 * 60 * 1000; // 24 hours

  if (!scheduleJobFn) return;

  scheduleJobFn({
    name: jobName,
    intervalMs,
    runOnStart: false,
    run: async () => {
      try {
        logger.debug({ event: 'autofetch:maintenance_job_started' });

        await service.maintenance();

        logger.info({
          event: 'autofetch:maintenance_job_completed',
        });
      } catch (error) {
        logger.error({
          event: 'autofetch:maintenance_job_error',
          error,
        });
      }
    },
  });
}

/**
 * Helper to manually trigger a refetch for testing/debugging
 * Not part of the scheduled job, but available for ad-hoc use
 */
export async function triggerRefetch(
  pool: Pool,
  sourceId: string,
  organizationId: string
): Promise<{ queued: number; conflicts: number; errors: number }> {
  const service = new AutoFetchService(pool);
  return service.fetchAndQueue(sourceId, organizationId);
}

/**
 * Helper to manually run maintenance tasks
 */
export async function triggerMaintenance(pool: Pool): Promise<void> {
  const service = new AutoFetchService(pool);
  return service.maintenance();
}
