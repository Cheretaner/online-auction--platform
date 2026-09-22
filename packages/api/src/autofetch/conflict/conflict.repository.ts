/**
 * Conflict Repository
 * Database access for conflict detection
 * Queries candidate auctions, fetches items, stores conflicts
 */

import { Pool } from 'pg';
import { ConflictFlag } from '../types/index.js';
import type { Auction } from '../../auction/auction.types.js';
import type { AuctionItemRecord } from '../../auction/auction-item.types.js';
import { logger } from '../../shared/utils/logger.js';

export class ConflictRepository {
  constructor(private pool: Pool) {}

  /**
   * Get candidate auctions to check for conflicts
   * Criteria: same org, published or upcoming, same region if specified
   */
  async getCandidateAuctions(
    organizationId: string,
    region?: string,
    category?: string
  ): Promise<Auction[]> {
    try {
      let query = `
        SELECT a.*
        FROM auctions a
        WHERE a.org_id = $1
          AND a.status IN ('published', 'active', 'upcoming')
          AND a.closes_at > NOW()
      `;

      const params: unknown[] = [organizationId];

      if (region) {
        query += ` AND a.region ILIKE $${params.length + 1}`;
        params.push(`%${region}%`);
      }

      query += ` ORDER BY a.closes_at DESC LIMIT 1000`;

      const result = await this.pool.query(query, params);
      return result.rows;
    } catch (error) {
      logger.error({
        event: 'conflict_repo:get_candidates_error',
        organizationId,
        error,
      });
      throw error;
    }
  }

  /**
   * Get all items for an auction
   */
  async getAuctionItems(auctionId: string): Promise<AuctionItemRecord[]> {
    try {
      const query = `
        SELECT ai.*
        FROM auction_items ai
        WHERE ai.auction_id = $1
      `;

      const result = await this.pool.query(query, [auctionId]);

      // Map DB rows to typed records (handle snake_case → camelCase)
      return result.rows.map((row) => this.mapRowToAuctionItem(row));
    } catch (error) {
      logger.error({
        event: 'conflict_repo:get_auction_items_error',
        auctionId,
        error,
      });
      throw error;
    }
  }

  /**
   * Get conflict flags for a pending item
   */
  async getConflictFlags(pendingItemId: string): Promise<ConflictFlag[]> {
    try {
      const query = `
        SELECT
          id,
          pending_item_id,
          conflicting_auction_id,
          conflict_type,
          severity,
          confidence_score,
          match_details,
          created_at
        FROM autofetch_conflicts
        WHERE pending_item_id = $1
        ORDER BY severity DESC, confidence_score DESC
      `;

      const result = await this.pool.query(query, [pendingItemId]);

      return result.rows.map((row) => ({
        id: row.id,
        pendingItemId: row.pending_item_id,
        conflictingAuctionId: row.conflicting_auction_id,
        conflictType: row.conflict_type,
        severity: row.severity,
        confidenceScore: row.confidence_score,
        matchDetails: row.match_details,
        createdAt: new Date(row.created_at),
      }));
    } catch (error) {
      logger.error({
        event: 'conflict_repo:get_flags_error',
        pendingItemId,
        error,
      });
      throw error;
    }
  }

  /**
   * Create conflict records in database
   */
  async createConflicts(conflicts: ConflictFlag[]): Promise<void> {
    if (conflicts.length === 0) return;

    try {
      const query = `
        INSERT INTO autofetch_conflicts (
          id,
          pending_item_id,
          conflicting_auction_id,
          conflict_type,
          severity,
          confidence_score,
          match_details,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT DO NOTHING
      `;

      for (const conflict of conflicts) {
        await this.pool.query(query, [
          conflict.id,
          conflict.pendingItemId,
          conflict.conflictingAuctionId,
          conflict.conflictType,
          conflict.severity,
          conflict.confidenceScore,
          JSON.stringify(conflict.matchDetails),
          conflict.createdAt,
        ]);
      }
    } catch (error) {
      logger.error({
        event: 'conflict_repo:create_conflicts_error',
        count: conflicts.length,
        error,
      });
      throw error;
    }
  }

  /**
   * Delete conflicts for a pending item
   */
  async deleteConflictsByPendingItem(pendingItemId: string): Promise<void> {
    try {
      const query = `DELETE FROM autofetch_conflicts WHERE pending_item_id = $1`;
      await this.pool.query(query, [pendingItemId]);
    } catch (error) {
      logger.error({
        event: 'conflict_repo:delete_conflicts_error',
        pendingItemId,
        error,
      });
      throw error;
    }
  }

  /**
   * Get conflict statistics for organization
   */
  async getConflictStats(organizationId: string): Promise<{
    total: number;
    bySeverity: Record<string, number>;
    avgConfidenceScore: number;
  }> {
    try {
      const query = `
        SELECT
          COUNT(*) as total,
          ROUND(AVG(confidence_score)) as avg_confidence,
          severity,
          COUNT(*) as count_by_severity
        FROM autofetch_conflicts ac
        JOIN autofetch_pending_items api ON ac.pending_item_id = api.id
        WHERE api.organization_id = $1
        GROUP BY severity
      `;

      const result = await this.pool.query(query, [organizationId]);

      const stats = {
        total: 0,
        bySeverity: {
          CRITICAL: 0,
          HIGH: 0,
          MEDIUM: 0,
          LOW: 0,
          NONE: 0,
        },
        avgConfidenceScore: 0,
      };

      for (const row of result.rows) {
        stats.total += row.count_by_severity;
        stats.bySeverity[row.severity] = row.count_by_severity;
        stats.avgConfidenceScore = row.avg_confidence;
      }

      return stats;
    } catch (error) {
      logger.error({
        event: 'conflict_repo:get_stats_error',
        organizationId,
        error,
      });
      throw error;
    }
  }

  /**
   * Map database row to AuctionItemRecord (snake_case → camelCase)
   */
  private mapRowToAuctionItem(row: any): AuctionItemRecord {
    return {
      id: row.id,
      auctionId: row.auction_id,
      title: row.title,
      description: row.description,
      quantity: row.quantity,
      unit: row.unit,
      estimatedValue: row.estimated_value ? Number(row.estimated_value) : null,
      categoryId: row.category_id,
      aiCategorySuggestion: row.ai_category_suggestion,
      aiSubCategory: row.ai_sub_category,
      aiConfidence: row.ai_confidence,
      aiRationale: row.ai_rationale,
      condition: row.condition,
      aiModel: row.ai_model,
      categorySource: row.category_source,
      region: row.region,
      city: row.city,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
