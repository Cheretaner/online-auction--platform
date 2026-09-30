/**
 * Conflict Detection Matchers
 * Individual matching algorithms for different conflict types
 */

import { NormalizedItem } from '../types/index.js';
import type { Auction } from '../../auction/auction.types.js';
import type { AuctionItemRecord } from '../../auction/auction-item.types.js';

// ============================================================================
// String Similarity (Levenshtein Distance)
// ============================================================================

/**
 * Calculate Levenshtein distance between two strings
 * Returns normalized score 0-100 (100 = identical)
 */
export function calculateStringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 100;
  if (s1.length === 0 || s2.length === 0) return 0;

  const matrix: number[][] = [];

  for (let i = 0; i <= s2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= s1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      const cost = s2.charAt(i - 1) === s1.charAt(j - 1) ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i][j - 1] + 1, // deletion
        matrix[i - 1][j] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  const maxLen = Math.max(s1.length, s2.length);
  const distance = matrix[s2.length][s1.length];
  return Math.round(((maxLen - distance) / maxLen) * 100);
}

// ============================================================================
// Title Similarity Matching
// ============================================================================

export interface TitleMatchResult {
  score: number;
  matched: boolean;
  reason: string;
}

/**
 * Check if two titles are likely duplicates
 * Threshold: >= 80% similarity
 */
export function matchTitle(pendingTitle: string, existingTitle: string): TitleMatchResult {
  const similarity = calculateStringSimilarity(pendingTitle, existingTitle);
  const threshold = 80;

  return {
    score: similarity,
    matched: similarity >= threshold,
    reason: similarity >= threshold ? 'High title similarity' : 'Title similarity below threshold',
  };
}

// ============================================================================
// SKU/Unique ID Matching
// ============================================================================

export interface SkuMatchResult {
  score: number;
  matched: boolean;
  reason: string;
}

/**
 * Check if items have matching external IDs or SKUs
 * Exact match only
 */
export function matchSku(
  pendingExternalId: string,
  existingItem: AuctionItemRecord | null,
  existingExternalId?: string
): SkuMatchResult {
  // Check raw external ID from pending
  if (existingExternalId && pendingExternalId === existingExternalId) {
    return {
      score: 100,
      matched: true,
      reason: 'Exact external ID match',
    };
  }

  // Could match against aiCategorySuggestion if it contains SKU-like data
  // For now, only exact matches
  return {
    score: 0,
    matched: false,
    reason: 'No SKU match',
  };
}

// ============================================================================
// Location Matching
// ============================================================================

export interface LocationMatchResult {
  score: number;
  matched: boolean;
  reason: string;
}

/**
 * Check if items are in same geographic region
 */
export function matchLocation(pendingItem: NormalizedItem, auctionItem: AuctionItemRecord | null, auction: Auction): LocationMatchResult {
  if (!pendingItem.region || !auction.region) {
    return {
      score: 0,
      matched: false,
      reason: 'Region information missing',
    };
  }

  const pendingRegion = pendingItem.region.toLowerCase().trim();
  const auctionRegion = auction.region.toLowerCase().trim();

  // Exact region match
  if (pendingRegion === auctionRegion) {
    // Check city if available
    if (pendingItem.city && auctionItem?.city) {
      const cityMatch = pendingItem.city.toLowerCase() === auctionItem.city.toLowerCase();
      return {
        score: cityMatch ? 100 : 80,
        matched: true,
        reason: cityMatch ? 'Region and city match' : 'Region matches (city different)',
      };
    }

    return {
      score: 80,
      matched: true,
      reason: 'Region matches',
    };
  }

  // Partial match (e.g., "Addis Ababa" vs "Addis")
  if (
    pendingRegion.includes(auctionRegion.substring(0, 5)) ||
    auctionRegion.includes(pendingRegion.substring(0, 5))
  ) {
    return {
      score: 40,
      matched: true,
      reason: 'Possible region overlap',
    };
  }

  return {
    score: 0,
    matched: false,
    reason: 'Different regions',
  };
}

// ============================================================================
// Temporal Overlap Matching
// ============================================================================

export interface TemporalMatchResult {
  score: number;
  matched: boolean;
  reason: string;
  daysApart: number;
}

/**
 * Check if auctions have overlapping or very close timelines
 */
export function matchTemporal(
  pendingItem: NormalizedItem,
  auction: Auction
): TemporalMatchResult {
  const auctionStart = new Date(auction.opensAt);
  const auctionEnd = new Date(auction.closesAt);
  const now = new Date();

  // If both auctions haven't started yet, check overlap
  if (auctionStart > now) {
    // Same day start (within 24 hours)
    const hoursApart = Math.abs(
      (now.getTime() - auctionStart.getTime()) / (1000 * 60 * 60)
    );

    if (hoursApart < 24) {
      return {
        score: 80,
        matched: true,
        reason: 'Auctions start within 24 hours',
        daysApart: Math.round(hoursApart / 24),
      };
    }

    // Within 7 days
    if (hoursApart < 24 * 7) {
      return {
        score: 50,
        matched: true,
        reason: 'Auctions start within 7 days',
        daysApart: Math.round(hoursApart / 24),
      };
    }
  }

  // Check if active auctions overlap
  if (auctionStart <= now && auctionEnd > now) {
    return {
      score: 70,
      matched: true,
      reason: 'Auction currently active',
      daysApart: 0,
    };
  }

  return {
    score: 0,
    matched: false,
    reason: 'No temporal overlap',
    daysApart: Math.round((auctionStart.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
  };
}

// ============================================================================
// Value Proximity Matching
// ============================================================================

export interface ValueMatchResult {
  score: number;
  matched: boolean;
  reason: string;
}

/**
 * Check if estimated values are within expected range
 * Items with similar values are likely duplicates
 */
export function matchValue(
  pendingValue: number | undefined,
  auctionValue: number | undefined
): ValueMatchResult {
  if (!pendingValue || !auctionValue) {
    return {
      score: 0,
      matched: false,
      reason: 'Value information missing',
    };
  }

  const ratio = Math.max(pendingValue, auctionValue) / Math.min(pendingValue, auctionValue);

  // Exact or very close (within 10%)
  if (ratio <= 1.1) {
    return {
      score: 95,
      matched: true,
      reason: 'Value very close (≤10% difference)',
    };
  }

  // Within 30%
  if (ratio <= 1.3) {
    return {
      score: 70,
      matched: true,
      reason: 'Value proximity (≤30% difference)',
    };
  }

  // Within 50%
  if (ratio <= 1.5) {
    return {
      score: 40,
      matched: true,
      reason: 'Value proximity (≤50% difference)',
    };
  }

  return {
    score: 0,
    matched: false,
    reason: 'Values significantly different',
  };
}

// ============================================================================
// Category Matching
// ============================================================================

export interface CategoryMatchResult {
  score: number;
  matched: boolean;
  reason: string;
}

/**
 * Check if items are in same category
 */
export function matchCategory(
  pendingCategory: string | undefined,
  existingCategory: string | undefined
): CategoryMatchResult {
  if (!pendingCategory || !existingCategory) {
    return {
      score: 0,
      matched: false,
      reason: 'Category information missing',
    };
  }

  const pending = pendingCategory.toLowerCase().trim();
  const existing = existingCategory.toLowerCase().trim();

  if (pending === existing) {
    return {
      score: 90,
      matched: true,
      reason: 'Exact category match',
    };
  }

  // Partial match (e.g., "Electronics" vs "Electronics & Appliances")
  if (pending.includes(existing) || existing.includes(pending)) {
    return {
      score: 60,
      matched: true,
      reason: 'Related category',
    };
  }

  return {
    score: 0,
    matched: false,
    reason: 'Different categories',
  };
}

// ============================================================================
// Quantity Matching
// ============================================================================

export interface QuantityMatchResult {
  score: number;
  matched: boolean;
  reason: string;
}

/**
 * Check if quantities suggest bulk purchase duplicate
 */
export function matchQuantity(pendingQty: number, existingQty: number): QuantityMatchResult {
  if (pendingQty === existingQty) {
    return {
      score: 85,
      matched: true,
      reason: 'Exact quantity match',
    };
  }

  const ratio = Math.max(pendingQty, existingQty) / Math.min(pendingQty, existingQty);

  if (ratio <= 1.1) {
    return {
      score: 70,
      matched: true,
      reason: 'Quantity very similar',
    };
  }

  return {
    score: 0,
    matched: false,
    reason: 'Quantities different',
  };
}
