/**
 * AutoFetch Service
 * Core orchestrator for the auto-fetch + verification pipeline
 * Coordinates: adapters → normalization → conflict detection → review queue → publishing
 */

import { logger } from '../shared/utils/logger.js';
import { adapterRegistry } from './adapters/index.js';
import { ConflictDetectionService } from './conflict/index.js';
import { ConflictRepository } from './conflict/conflict.repository.js';
import { AutoFetchRepository } from './autofetch.repository.js';
import { NormalizedItem, PendingQueueResult, ReviewAction } from './types/index.js';
import type { Pool } from 'pg';
import type { AuctionItemRecord } from '../auction/auction-item.types.js';
import * as auctionItemService from '../auction/auction-item.service.js';
import { AppError } from '../shared/errors/index.js';
import type { Role } from '@auction/shared';

export class AutoFetchService {
  private pool: Pool;
  private autofetchRepo: AutoFetchRepository;
  private conflictService: ConflictDetectionService;

  constructor(pool: Pool) {
    this.pool = pool;
    this.autofetchRepo = new AutoFetchRepository(pool);
    const conflictRepo = new ConflictRepository(pool);
    this.conflictService = new ConflictDetectionService(conflictRepo);
  }

  /**
   * Fetch from a source, normalize items, detect conflicts, queue for review
   * Main entry point for the pipeline
   *
   * @returns Summary of fetch operation (queued count, conflicts found)
   */
  async fetchAndQueue(
    sourceId: string,
    organizationId: string
  ): Promise<{ queued: number; conflicts: number; errors: number }> {
    try {
      logger.info({
        event: 'autofetch:fetch_started',
        sourceId,
        organizationId,
      });

      // Get source config
      const source = await this.autofetchRepo.getSourceForOrganization(sourceId, organizationId);
      if (!source) {
        throw AppError.notFound('Source not found');
      }

      if (!source.isActive) {
        logger.debug({
          event: 'autofetch:source_disabled',
          sourceId,
        });
        return { queued: 0, conflicts: 0, errors: 0 };
      }

      // Get adapter
      const registeredAdapter = adapterRegistry.get(source.adapterType);
      // Source configuration is stateful for some adapters. Isolate each
      // fetch so concurrent sources cannot overwrite URL or API-key state.
      const adapter = registeredAdapter.create?.() ?? registeredAdapter;
      adapter.configure?.({ ...source.adapterConfig, url: source.sourceUrl ?? source.adapterConfig.url });

      // Fetch from external source
      const fetchedItems = await adapter.fetchItems('', {
        timeout: 30000,
        retryCount: 3,
      });

      logger.debug({
        event: 'autofetch:fetched',
        sourceId,
        itemCount: fetchedItems.length,
      });

      // Normalize and filter stale items
      const normalizedItems: Array<{
        item: NormalizedItem;
        raw: unknown;
      }> = [];

      for (const fetched of fetchedItems) {
        try {
          const normalized = await adapter.normalize(fetched.metadata);

          if (adapter.isStale(normalized)) {
            logger.debug({
              event: 'autofetch:item_stale',
              externalId: fetched.externalId,
            });
            await this.autofetchRepo.logAuditEvent(null, sourceId, 'item_stale', {
              externalId: fetched.externalId,
            });
            continue;
          }

          normalizedItems.push({ item: normalized, raw: fetched.metadata });
        } catch (error) {
          logger.error({
            event: 'autofetch:normalization_error',
            externalId: fetched.externalId,
            error,
          });
          await this.autofetchRepo.logAuditEvent(null, sourceId, 'normalization_error', {
            externalId: fetched.externalId,
            error: String(error),
          });
        }
      }

      // Score confidence for each item
      const itemsToQueue = normalizedItems.map(({ item, raw }) => {
        const confidence = adapter.scoreConfidence(item);
        return {
          sourceId,
          organizationId,
          externalId: item.externalId,
          title: item.title,
          description: item.description,
          rawMetadata: raw as Record<string, unknown>,
          normalizedMetadata: { ...item },
          aiConfidence: confidence.overall,
          estimatedValue: item.estimatedValue,
          categorySuggestion: item.categoryName,
        };
      });

      // Queue items (deduped by source_id + external_id)
      const queuedItems = await this.autofetchRepo.createPendingItems(itemsToQueue);

      logger.debug({
        event: 'autofetch:queued',
        sourceId,
        queuedCount: queuedItems.length,
      });

      // Detect conflicts for each queued item
      let conflictCount = 0;
      for (const item of queuedItems) {
        try {
          const conflicts = await this.conflictService.detectConflicts(
            item.id,
            item.normalizedMetadata as NormalizedItem,
            organizationId
          );

          if (conflicts.length > 0) {
            await this.conflictService.saveConflicts(conflicts);
            conflictCount += conflicts.length;

            logger.info({
              event: 'autofetch:conflicts_detected',
              pendingItemId: item.id,
              conflictCount: conflicts.length,
            });

            await this.autofetchRepo.logAuditEvent(item.id, sourceId, 'conflicts_detected', {
              count: conflicts.length,
              severities: conflicts.map((c) => c.severity),
            });
          }
        } catch (error) {
          logger.error({
            event: 'autofetch:conflict_detection_error',
            pendingItemId: item.id,
            error,
          });
          await this.autofetchRepo.logAuditEvent(item.id, sourceId, 'conflict_error', {
            error: String(error),
          });
        }
      }

      // Update source fetch metadata
      const nextFetchAt = new Date();
      nextFetchAt.setHours(nextFetchAt.getHours() + 1); // Fetch again in 1 hour
      await this.autofetchRepo.updateSourceFetchMetadata(sourceId, new Date(), nextFetchAt);

      logger.info({
        event: 'autofetch:fetch_completed',
        sourceId,
        queuedCount: queuedItems.length,
        conflictCount,
      });

      return {
        queued: queuedItems.length,
        conflicts: conflictCount,
        errors: fetchedItems.length - queuedItems.length,
      };
    } catch (error) {
      logger.error({
        event: 'autofetch:fetch_error',
        sourceId,
        error,
      });

      await this.autofetchRepo.logAuditEvent(null, sourceId, 'fetch_error', {
        error: String(error),
      });

      throw error;
    }
  }

  /**
   * Admin approves a pending item for publication
   * Creates AuctionItem and marks pending as approved
   */
  async approveAndPublish(
    pendingItemId: string,
    actor: { userId: string; organizationId?: string; roles: Role[] },
    auctionId: string
  ): Promise<AuctionItemRecord> {
    try {
      logger.info({
        event: 'autofetch:approval_started',
        pendingItemId,
        auctionId,
      });

      // Get pending item
      const pending = actor.organizationId
        ? await this.autofetchRepo.getPendingItemForOrganization(pendingItemId, actor.organizationId)
        : actor.roles.includes('super_admin') ? await this.autofetchRepo.getPendingItemWithConflicts(pendingItemId) : null;
      if (!pending) {
        throw AppError.notFound('Pending item not found');
      }
      if (pending.status !== 'pending') throw AppError.conflict('Pending item has already been reviewed');

      const metadata = pending.normalizedMetadata;
      const item = await auctionItemService.createAuctionItem(actor, auctionId, {
        title: metadata.title,
        description: metadata.description,
        quantity: metadata.quantity,
        unit: metadata.unit,
        estimatedValue: metadata.estimatedValue === undefined ? undefined : metadata.estimatedValue.toFixed(2),
        categoryId: metadata.categoryId,
        categorySource: 'manual',
        region: metadata.region,
        city: metadata.city,
      });

      // Record review
      await this.autofetchRepo.createReview(pendingItemId, actor.userId, 'approve', '');

      // Update pending item status
      await this.autofetchRepo.updatePendingItemStatus(pendingItemId, 'approved');

      // Clear conflicts now that it's approved
      await this.conflictService.clearConflicts(pendingItemId);

      // Log to audit
      await this.autofetchRepo.logAuditEvent(pendingItemId, pending.sourceId, 'approved', {
        auctionId,
        reviewedBy: actor.userId,
      });

      logger.info({
        event: 'autofetch:approved',
        pendingItemId,
        auctionId,
      });

      return item;
    } catch (error) {
      logger.error({
        event: 'autofetch:approval_error',
        pendingItemId,
        error,
      });
      throw error;
    }
  }

  /**
   * Admin rejects a pending item
   */
  async reject(
    pendingItemId: string,
    actor: { userId: string; organizationId?: string; roles: Role[] },
    reason: string
  ): Promise<void> {
    try {
      logger.info({
        event: 'autofetch:rejection_started',
        pendingItemId,
      });

      // Get pending item
      const pending = actor.organizationId
        ? await this.autofetchRepo.getPendingItemForOrganization(pendingItemId, actor.organizationId)
        : actor.roles.includes('super_admin') ? await this.autofetchRepo.getPendingItemWithConflicts(pendingItemId) : null;
      if (!pending) {
        throw AppError.notFound('Pending item not found');
      }
      if (pending.status !== 'pending') throw AppError.conflict('Pending item has already been reviewed');

      // Record review
      await this.autofetchRepo.createReview(pendingItemId, actor.userId, 'reject', reason);

      // Update pending item status
      await this.autofetchRepo.updatePendingItemStatus(pendingItemId, 'rejected');

      // Clear conflicts
      await this.conflictService.clearConflicts(pendingItemId);

      // Log to audit
      await this.autofetchRepo.logAuditEvent(pendingItemId, pending.sourceId, 'rejected', {
        reason,
        rejectedBy: actor.userId,
      });

      logger.info({
        event: 'autofetch:rejected',
        pendingItemId,
      });
    } catch (error) {
      logger.error({
        event: 'autofetch:rejection_error',
        pendingItemId,
        error,
      });
      throw error;
    }
  }

  /**
   * Get pending review queue for org
   */
  async getPendingQueue(
    organizationId: string,
    filters: {
      severityMin?: string;
      sourceId?: string;
      status?: string;
    } = {},
    limit: number = 50,
    offset: number = 0
  ): Promise<PendingQueueResult> {
    try {
      return await this.autofetchRepo.getPendingQueue(
        organizationId,
        filters,
        limit,
        offset
      );
    } catch (error) {
      logger.error({
        event: 'autofetch:get_queue_error',
        organizationId,
        error,
      });
      throw error;
    }
  }

  /**
   * Get conflict flags for a pending item
   */
  async getConflictFlags(pendingItemId: string) {
    try {
      return await this.conflictService.getConflictFlags(pendingItemId);
    } catch (error) {
      logger.error({
        event: 'autofetch:get_conflicts_error',
        pendingItemId,
        error,
      });
      throw error;
    }
  }

  async getPendingItem(pendingItemId: string, organizationId: string) {
    const item = await this.autofetchRepo.getPendingItemForOrganization(pendingItemId, organizationId);
    if (!item) throw AppError.notFound('Pending item not found');
    return item;
  }

  /**
   * Get conflict statistics for org
   */
  async getConflictStats(organizationId: string) {
    try {
      const conflictRepo = new ConflictRepository(this.pool);
      return await conflictRepo.getConflictStats(organizationId);
    } catch (error) {
      logger.error({
        event: 'autofetch:get_stats_error',
        organizationId,
        error,
      });
      throw error;
    }
  }

  /**
   * Get all sources for an org
   */
  async getSourcesByOrg(organizationId: string) {
    try {
      return await this.autofetchRepo.getSourcesByOrg(organizationId);
    } catch (error) {
      logger.error({
        event: 'autofetch:get_sources_error',
        organizationId,
        error,
      });
      throw error;
    }
  }

  /**
   * Create a new source
   */
  async createSource(
    organizationId: string,
    config: {
      name: string;
      adapterType: string;
      sourceUrl?: string;
      adapterConfig: Record<string, unknown>;
    }
  ) {
    try {
      // Validate adapter exists
      adapterRegistry.get(config.adapterType);

      // Validate adapter-specific config if adapter provides validator
      const adapter = adapterRegistry.get(config.adapterType);
      if (adapter.validateConfig) {
        await adapter.validateConfig({ ...config.adapterConfig, url: config.sourceUrl ?? config.adapterConfig.url });
      }

      const source = await this.autofetchRepo.createSource(organizationId, {
        name: config.name,
        adapterType: config.adapterType,
        sourceUrl: config.sourceUrl,
        adapterConfig: config.adapterConfig,
        isActive: true,
        nextFetchAt: new Date(), // Fetch immediately
      });

      logger.info({
        event: 'autofetch:source_created',
        sourceId: source.id,
        organizationId,
      });

      return source;
    } catch (error) {
      logger.error({
        event: 'autofetch:create_source_error',
        organizationId,
        error,
      });
      throw error;
    }
  }

  /**
   * Cleanup and maintenance tasks (called by scheduler)
   */
  async maintenance(): Promise<void> {
    try {
      logger.debug({ event: 'autofetch:maintenance_started' });

      // Expire old pending items (60+ days)
      const expiredCount = await this.autofetchRepo.expirePendingItemsOlderThan(60);

      logger.info({
        event: 'autofetch:maintenance_completed',
        expiredCount,
      });
    } catch (error) {
      logger.error({
        event: 'autofetch:maintenance_error',
        error,
      });
      throw error;
    }
  }
}
