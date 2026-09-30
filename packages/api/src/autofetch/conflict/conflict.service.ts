/**
 * Conflict Detection Service
 * Core logic for detecting duplicates, overlaps, and conflicting auctions
 */

import { logger } from '../../shared/utils/logger.js';
import { ConflictFlag, ConflictSeverity, NormalizedItem } from '../types/index.js';
import type { Auction } from '../../auction/auction.types.js';
import type { AuctionItemRecord } from '../../auction/auction-item.types.js';
import {
  matchTitle,
  matchSku,
  matchLocation,
  matchTemporal,
  matchValue,
  matchCategory,
  matchQuantity,
} from './matchers.js';
import { ConflictRepository } from './conflict.repository.js';

export class ConflictDetectionService {
  private repo: ConflictRepository;

  constructor(repository: ConflictRepository) {
    this.repo = repository;
  }

  /**
   * Detect all conflicts for a pending item against existing auctions
   * Runs all matchers and aggregates results into severity levels
   *
   * @param pendingItem Normalized item from external source
   * @param organizationId Org ID to scope search
   * @returns Array of detected conflicts
   */
  async detectConflicts(
    pendingItemId: string,
    pendingItem: NormalizedItem,
    organizationId: string
  ): Promise<ConflictFlag[]> {
    try {
      logger.debug({
        event: 'conflict:detection_started',
        pendingItemId,
        title: pendingItem.title,
      });

      // Get candidate auctions to check (same org, active/upcoming, same region if specified)
      const candidates = await this.repo.getCandidateAuctions(
        organizationId,
        pendingItem.region,
        pendingItem.categoryName
      );

      if (candidates.length === 0) {
        logger.debug({
          event: 'conflict:no_candidates',
          pendingItemId,
        });
        return [];
      }

      const conflicts: ConflictFlag[] = [];

      for (const auction of candidates) {
        const auctionItems = await this.repo.getAuctionItems(auction.id);

        for (const item of auctionItems) {
          const matchResult = this.scoreMatch(pendingItem, item, auction);

          if (matchResult.severity !== 'NONE') {
            const conflict: ConflictFlag = {
              id: `conflict:${pendingItemId}:${auction.id}`,
              pendingItemId,
              conflictingAuctionId: auction.id,
              conflictType: this.determineConflictType(matchResult),
              severity: matchResult.severity,
              confidenceScore: matchResult.score,
              matchDetails: matchResult.details,
              createdAt: new Date(),
            };

            conflicts.push(conflict);

            logger.info({
              event: 'conflict:detected',
              pendingItemId,
              auctionId: auction.id,
              severity: conflict.severity,
              score: conflict.confidenceScore,
            });
          }
        }
      }

      return conflicts;
    } catch (error) {
      logger.error({
        event: 'conflict:detection_error',
        pendingItemId,
        error,
      });
      throw error;
    }
  }

  /**
   * Score how well the pending item matches an existing auction item
   * Runs all matchers and weights results
   */
  private scoreMatch(
    pendingItem: NormalizedItem,
    existingItem: AuctionItemRecord,
    auction: Auction
  ) {
    // Run individual matchers
    const titleMatch = matchTitle(pendingItem.title, existingItem.title);
    const skuMatch = matchSku(pendingItem.externalId, existingItem);
    const locationMatch = matchLocation(pendingItem, existingItem, auction);
    const temporalMatch = matchTemporal(pendingItem, auction);
    const valueMatch = matchValue(pendingItem.estimatedValue, existingItem.estimatedValue ?? undefined);
    const categoryMatch = matchCategory(
      pendingItem.categoryName,
      existingItem.categorySource
    );
    const quantityMatch = matchQuantity(pendingItem.quantity, existingItem.quantity);

    // Weighted scoring (importance of each matcher)
    const weights = {
      title: 0.25,
      sku: 0.35, // Highest priority: SKU match is definitive
      location: 0.15,
      temporal: 0.1,
      value: 0.1,
      category: 0.03,
      quantity: 0.02,
    };

    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);

    const score = Math.round(
      ((titleMatch.score * weights.title +
        skuMatch.score * weights.sku +
        locationMatch.score * weights.location +
        temporalMatch.score * weights.temporal +
        valueMatch.score * weights.value +
        categoryMatch.score * weights.category +
        quantityMatch.score * weights.quantity) /
        totalWeight)
    );

    // Determine severity based on score and specific conditions
    const severity = this.determineSeverity(score, {
      skuMatch: skuMatch.matched,
      titleMatch: titleMatch.matched,
      locationMatch: locationMatch.matched,
      temporalMatch: temporalMatch.matched,
    });

    const details = {
      titleMatch: titleMatch.score,
      skuMatch: skuMatch.matched,
      locationMatch: locationMatch.matched,
      dateOverlap: temporalMatch.matched,
      valueProximity: valueMatch.score,
      categoryMatch: categoryMatch.matched,
    };

    return { score, severity, details };
  }

  /**
   * Determine conflict severity from score and matcher results
   */
  private determineSeverity(
    score: number,
    matches: {
      skuMatch: boolean;
      titleMatch: boolean;
      locationMatch: boolean;
      temporalMatch: boolean;
    }
  ): ConflictSeverity {
    // CRITICAL: SKU match (definitive duplicate) or very high score
    if (matches.skuMatch || score >= 90) {
      return 'CRITICAL';
    }

    // CRITICAL: Title + location + temporal all match
    if (matches.titleMatch && matches.locationMatch && matches.temporalMatch && score >= 80) {
      return 'CRITICAL';
    }

    // HIGH: Strong score with multiple matches
    if (score >= 70 && (matches.titleMatch && matches.locationMatch)) {
      return 'HIGH';
    }

    // HIGH: Score 70+
    if (score >= 70) {
      return 'HIGH';
    }

    // MEDIUM: Moderate score
    if (score >= 50) {
      return 'MEDIUM';
    }

    // LOW: Weak signal
    if (score >= 20) {
      return 'LOW';
    }

    return 'NONE';
  }

  /**
   * Determine conflict type from matcher results
   */
  private determineConflictType(
    result: ReturnType<typeof this.scoreMatch>
  ): 'duplicate' | 'overlap' | 'category_conflict' | 'temporal_conflict' {
    if (result.details.skuMatch) {
      return 'duplicate';
    }

    if (result.details.titleMatch && result.details.locationMatch) {
      return 'duplicate';
    }

    if (result.details.dateOverlap && result.details.locationMatch) {
      return 'temporal_conflict';
    }

    if (result.details.categoryMatch && result.details.locationMatch) {
      return 'category_conflict';
    }

    return 'overlap';
  }

  /**
   * Get existing conflict flags for a pending item
   */
  async getConflictFlags(pendingItemId: string): Promise<ConflictFlag[]> {
    return this.repo.getConflictFlags(pendingItemId);
  }

  /**
   * Store detected conflicts in database
   */
  async saveConflicts(conflicts: ConflictFlag[]): Promise<void> {
    if (conflicts.length === 0) return;

    await this.repo.createConflicts(conflicts);
    logger.info({
      event: 'conflict:saved',
      count: conflicts.length,
    });
  }

  /**
   * Delete conflicts for a pending item (e.g., when it's approved/rejected)
   */
  async clearConflicts(pendingItemId: string): Promise<void> {
    await this.repo.deleteConflictsByPendingItem(pendingItemId);
  }

  /**
   * Get conflict summary statistics for org
   */
  async getConflictStats(organizationId: string) {
    return this.repo.getConflictStats(organizationId);
  }
}
