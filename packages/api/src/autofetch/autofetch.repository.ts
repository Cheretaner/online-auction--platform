/**
 * AutoFetch Repository
 * Database access for autofetch operations
 * Manages sources, pending items, reviews, and audit logging
 */

import { Pool } from 'pg';
import { logger } from '../shared/utils/logger.js';
import {
  PendingItem,
  PendingQueueItem,
  PendingQueueResult,
  ReviewRecord,
  SourceConfig,
} from './types/index.js';
import type { AuctionItemRecord } from '../auction/auction-item.types.js';

export class AutoFetchRepository {
  constructor(private pool: Pool) {}

  // ========================================================================
  // Source Management
  // ========================================================================

  /**
   * Create a new data source configuration
   */
  async createSource(
    organizationId: string,
    config: Omit<SourceConfig, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<SourceConfig> {
    try {
      const query = `
        INSERT INTO autofetch_sources (
          organization_id, name, adapter_type, source_url, config, is_active, next_fetch_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING
          id, organization_id, name, adapter_type, source_url, config,
          is_active, last_fetched_at, next_fetch_at, created_at, updated_at
      `;

      const result = await this.pool.query(query, [
        organizationId,
        config.name,
        config.adapterType,
        config.sourceUrl,
        JSON.stringify(config.adapterConfig),
        config.isActive,
        config.nextFetchAt,
      ]);

      return this.mapRowToSourceConfig(result.rows[0]);
    } catch (error) {
      logger.error({
        event: 'autofetch_repo:create_source_error',
        organizationId,
        error,
      });
      throw error;
    }
  }

  /**
   * Get source by ID
   */
  async getSource(sourceId: string): Promise<SourceConfig | null> {
    try {
      const query = `
        SELECT * FROM autofetch_sources WHERE id = $1
      `;

      const result = await this.pool.query(query, [sourceId]);
      return result.rows[0] ? this.mapRowToSourceConfig(result.rows[0]) : null;
    } catch (error) {
      logger.error({
        event: 'autofetch_repo:get_source_error',
        sourceId,
        error,
      });
      throw error;
    }
  }

  /**
   * Get all sources for an org
   */
  async getSourcesByOrg(organizationId: string): Promise<SourceConfig[]> {
    try {
      const query = `
        SELECT * FROM autofetch_sources
        WHERE organization_id = $1
        ORDER BY created_at DESC
      `;

      const result = await this.pool.query(query, [organizationId]);
      return result.rows.map((row) => this.mapRowToSourceConfig(row));
    } catch (error) {
      logger.error({
        event: 'autofetch_repo:get_sources_by_org_error',
        organizationId,
        error,
      });
      throw error;
    }
  }

  /**
   * Get active sources due for refetch
   */
  async getSourcesDueForRefetch(): Promise<
    Array<SourceConfig & { organizationId: string }>
  > {
    try {
      const query = `
        SELECT * FROM autofetch_sources
        WHERE is_active = true AND (next_fetch_at IS NULL OR next_fetch_at <= NOW())
        ORDER BY next_fetch_at ASC
        LIMIT 1000
      `;

      const result = await this.pool.query(query);
      return result.rows.map((row) => this.mapRowToSourceConfig(row));
    } catch (error) {
      logger.error({
        event: 'autofetch_repo:get_sources_due_error',
        error,
      });
      throw error;
    }
  }

  /**
   * Update source with fetch metadata
   */
  async updateSourceFetchMetadata(
    sourceId: string,
    lastFetchedAt: Date,
    nextFetchAt: Date
  ): Promise<void> {
    try {
      const query = `
        UPDATE autofetch_sources
        SET last_fetched_at = $1, next_fetch_at = $2, updated_at = NOW()
        WHERE id = $3
      `;

      await this.pool.query(query, [lastFetchedAt, nextFetchAt, sourceId]);
    } catch (error) {
      logger.error({
        event: 'autofetch_repo:update_source_metadata_error',
        sourceId,
        error,
      });
      throw error;
    }
  }

  // ========================================================================
  // Pending Items Queue
  // ========================================================================

  /**
   * Add items to pending queue
   */
  async createPendingItems(
    items: Array<{
      sourceId: string;
      organizationId: string;
      externalId: string;
      title: string;
      description?: string;
      rawMetadata: Record<string, unknown>;
      normalizedMetadata: Record<string, unknown>;
      aiConfidence: number;
      estimatedValue?: number;
      categorySuggestion?: string;
    }>
  ): Promise<PendingItem[]> {
    if (items.length === 0) return [];

    try {
      const placeholders = items
        .map(
          (_, i) =>
            `($${i * 9 + 1}, $${i * 9 + 2}, $${i * 9 + 3}, $${i * 9 + 4}, $${i * 9 + 5}, $${i * 9 + 6}, $${i * 9 + 7}, $${i * 9 + 8}, $${i * 9 + 9})`
        )
        .join(',');

      const query = `
        INSERT INTO autofetch_pending_items (
          source_id, organization_id, external_id, title, description,
          raw_metadata, normalized_metadata, ai_confidence, estimated_value, category_suggestion
        )
        VALUES ${placeholders}
        ON CONFLICT (source_id, external_id) DO NOTHING
        RETURNING *
      `;

      const values = items.flatMap((item) => [
        item.sourceId,
        item.organizationId,
        item.externalId,
        item.title,
        item.description,
        JSON.stringify(item.rawMetadata),
        JSON.stringify(item.normalizedMetadata),
        item.aiConfidence,
        item.estimatedValue,
        item.categorySuggestion,
      ]);

      const result = await this.pool.query(query, values);
      return result.rows.map((row) => this.mapRowToPendingItem(row));
    } catch (error) {
      logger.error({
        event: 'autofetch_repo:create_pending_items_error',
        count: items.length,
        error,
      });
      throw error;
    }
  }

  /**
   * Get pending queue for org (paginated with filters)
   */
  async getPendingQueue(
    organizationId: string,
    filters: {
      severityMin?: string;
      sourceId?: string;
      status?: string;
    },
    limit: number,
    offset: number
  ): Promise<PendingQueueResult> {
    try {
      let whereClause = 'api.organization_id = $1';
      const params: unknown[] = [organizationId];

      if (filters.status) {
        whereClause += ` AND api.status = $${params.length + 1}`;
        params.push(filters.status);
      }

      if (filters.sourceId) {
        whereClause += ` AND api.source_id = $${params.length + 1}`;
        params.push(filters.sourceId);
      }

      // Get total count
      const countQuery = `SELECT COUNT(*) as total FROM autofetch_pending_items api WHERE ${whereClause}`;
      const countResult = await this.pool.query(countQuery, params);
      const total = parseInt(countResult.rows[0].total, 10);

      // Get paginated results with conflict count
      const query = `
        SELECT
          api.id,
          api.title,
          asrc.name as source,
          api.estimated_value,
          api.category_suggestion,
          api.ai_confidence,
          api.status,
          api.created_at,
          api.updated_at,
          COALESCE(COUNT(ac.id), 0)::INT as conflict_count,
          COALESCE(SUM(CASE WHEN ac.severity = 'CRITICAL' THEN 1 ELSE 0 END), 0)::INT as high_severity_conflicts
        FROM autofetch_pending_items api
        LEFT JOIN autofetch_sources asrc ON api.source_id = asrc.id
        LEFT JOIN autofetch_conflicts ac ON api.id = ac.pending_item_id
        WHERE ${whereClause}
        GROUP BY api.id, asrc.name
        ORDER BY api.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;

      const result = await this.pool.query(query, [...params, limit, offset]);

      const items: PendingQueueItem[] = result.rows.map((row) => ({
        id: row.id,
        title: row.title,
        source: row.source,
        estimatedValue: row.estimated_value ? Number(row.estimated_value) : undefined,
        categoryName: row.category_suggestion,
        confidenceScore: row.ai_confidence,
        status: row.status,
        conflictCount: row.conflict_count,
        highSeverityConflicts: row.high_severity_conflicts,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
      }));

      return {
        items,
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      };
    } catch (error) {
      logger.error({
        event: 'autofetch_repo:get_pending_queue_error',
        organizationId,
        error,
      });
      throw error;
    }
  }

  /**
   * Get a specific pending item with its conflicts
   */
  async getPendingItemWithConflicts(pendingItemId: string): Promise<PendingItem | null> {
    try {
      const query = `
        SELECT *
        FROM autofetch_pending_items
        WHERE id = $1
      `;

      const result = await this.pool.query(query, [pendingItemId]);
      if (result.rows.length === 0) return null;

      return this.mapRowToPendingItem(result.rows[0]);
    } catch (error) {
      logger.error({
        event: 'autofetch_repo:get_pending_item_error',
        pendingItemId,
        error,
      });
      throw error;
    }
  }

  /**
   * Update pending item status
   */
  async updatePendingItemStatus(
    pendingItemId: string,
    status: string
  ): Promise<void> {
    try {
      const query = `
        UPDATE autofetch_pending_items
        SET status = $1, updated_at = NOW()
        WHERE id = $2
      `;

      await this.pool.query(query, [status, pendingItemId]);
    } catch (error) {
      logger.error({
        event: 'autofetch_repo:update_pending_status_error',
        pendingItemId,
        error,
      });
      throw error;
    }
  }

  /**
   * Mark old pending items as expired (60+ days without action)
   */
  async expirePendingItemsOlderThan(days: number): Promise<number> {
    try {
      const query = `
        UPDATE autofetch_pending_items
        SET status = 'expired', updated_at = NOW()
        WHERE status = 'pending' AND created_at < NOW() - INTERVAL '1 day' * $1
        RETURNING id
      `;

      const result = await this.pool.query(query, [days]);
      return result.rowCount || 0;
    } catch (error) {
      logger.error({
        event: 'autofetch_repo:expire_pending_error',
        days,
        error,
      });
      throw error;
    }
  }

  // ========================================================================
  // Reviews
  // ========================================================================

  /**
   * Create review record
   */
  async createReview(
    pendingItemId: string,
    reviewedById: string,
    action: string,
    notes?: string
  ): Promise<ReviewRecord> {
    try {
      const query = `
        INSERT INTO autofetch_reviews (pending_item_id, reviewed_by_id, action, notes)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (pending_item_id) DO UPDATE SET
          reviewed_by_id = $2,
          action = $3,
          notes = $4,
          reviewed_at = NOW()
        RETURNING *
      `;

      const result = await this.pool.query(query, [
        pendingItemId,
        reviewedById,
        action,
        notes,
      ]);

      const row = result.rows[0];
      return {
        id: row.id,
        pendingItemId: row.pending_item_id,
        reviewedById: row.reviewed_by_id,
        action: row.action,
        notes: row.notes,
        reviewedAt: new Date(row.reviewed_at),
      };
    } catch (error) {
      logger.error({
        event: 'autofetch_repo:create_review_error',
        pendingItemId,
        error,
      });
      throw error;
    }
  }

  // ========================================================================
  // Audit Trail
  // ========================================================================

  /**
   * Log autofetch audit event
   */
  async logAuditEvent(
    pendingItemId: string | null,
    sourceId: string | null,
    eventType: string,
    eventData: Record<string, unknown>
  ): Promise<void> {
    try {
      const query = `
        INSERT INTO autofetch_audit (pending_item_id, source_id, event_type, event_data)
        VALUES ($1, $2, $3, $4)
      `;

      await this.pool.query(query, [
        pendingItemId,
        sourceId,
        eventType,
        JSON.stringify(eventData),
      ]);
    } catch (error) {
      logger.error({
        event: 'autofetch_repo:log_audit_error',
        pendingItemId,
        error,
      });
      throw error;
    }
  }

  // ========================================================================
  // Mappers
  // ========================================================================

  private mapRowToSourceConfig(row: any): SourceConfig {
    return {
      id: row.id,
      organizationId: row.organization_id,
      name: row.name,
      adapterType: row.adapter_type,
      sourceUrl: row.source_url,
      adapterConfig: row.config || {},
      isActive: row.is_active,
      lastFetchedAt: row.last_fetched_at ? new Date(row.last_fetched_at) : undefined,
      nextFetchAt: row.next_fetch_at ? new Date(row.next_fetch_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapRowToPendingItem(row: any): PendingItem {
    return {
      id: row.id,
      sourceId: row.source_id,
      organizationId: row.organization_id,
      externalId: row.external_id,
      title: row.title,
      description: row.description,
      normalizedMetadata: row.normalized_metadata,
      confidenceScore: {
        overall: row.ai_confidence,
        titleQuality: 0,
        descriptionQuality: 0,
        valueQuality: 0,
        categoryQuality: 0,
        locationQuality: 0,
        rationale: [],
      },
      status: row.status,
      conflicts: [],
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
