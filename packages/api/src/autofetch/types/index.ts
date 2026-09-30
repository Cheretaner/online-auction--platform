/**
 * Auto-fetch + verification pipeline types
 * Defines normalized item structures, confidence scores, and data flow types
 */

// ============================================================================
// Adapter Input/Output Types
// ============================================================================

export interface FetchOptions {
  limit?: number;
  offset?: number;
  timeout?: number;
  retryCount?: number;
}

/**
 * Raw data fetched from an external source before normalization
 */
export interface SourceFetch {
  id: string;
  externalId: string;
  title: string;
  description?: string;
  metadata: Record<string, unknown>;
  source: string;
  fetchedAt: Date;
}

/**
 * Normalized item structure matching AuctionItem shape
 * After adapter processes and maps external data to our domain
 */
export interface NormalizedItem {
  title: string;
  description?: string;
  quantity: number;
  unit?: string;
  estimatedValue?: number;
  categoryId?: string;
  categoryName?: string;
  condition?: string;
  region?: string;
  city?: string;
  externalId: string;
  externalSource: string;
  rawMetadata: Record<string, unknown>;
}

/**
 * Confidence score breakdown for a normalized item
 */
export interface ConfidenceScore {
  overall: number; // 0-100
  titleQuality: number;
  descriptionQuality: number;
  valueQuality: number;
  categoryQuality: number;
  locationQuality: number;
  rationale: string[];
}

// ============================================================================
// Conflict Detection Types
// ============================================================================

export type ConflictType = 'duplicate' | 'overlap' | 'category_conflict' | 'temporal_conflict';

export type ConflictSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

/**
 * A detected conflict between a pending item and an existing auction
 */
export interface ConflictFlag {
  id: string;
  pendingItemId: string;
  conflictingAuctionId: string | null;
  conflictType: ConflictType;
  severity: ConflictSeverity;
  confidenceScore: number; // 0-100
  matchDetails: {
    titleMatch?: number;
    skuMatch?: boolean;
    locationMatch?: boolean;
    dateOverlap?: boolean;
    valueProximity?: number;
    categoryMatch?: boolean;
  };
  createdAt: Date;
}

// ============================================================================
// Review Queue Types
// ============================================================================

export type PendingItemStatus = 'pending' | 'approved' | 'rejected' | 'published' | 'expired';

export type ReviewAction = 'approve' | 'reject' | 'flag_for_manual_review';

/**
 * A pending item in the review queue
 */
export interface PendingItem {
  id: string;
  sourceId: string;
  organizationId: string;
  externalId: string;
  title: string;
  description?: string;
  normalizedMetadata: NormalizedItem;
  confidenceScore: ConfidenceScore;
  status: PendingItemStatus;
  conflicts: ConflictFlag[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Item in the review queue with conflict summary
 */
export interface PendingQueueItem {
  id: string;
  title: string;
  source: string;
  estimatedValue?: number;
  categoryName?: string;
  confidenceScore: number;
  status: PendingItemStatus;
  conflictCount: number;
  highSeverityConflicts: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Paginated result for pending queue
 */
export interface PendingQueueResult {
  items: PendingQueueItem[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/**
 * Admin review action
 */
export interface ReviewRecord {
  id: string;
  pendingItemId: string;
  reviewedById: string;
  action: ReviewAction;
  notes?: string;
  reviewedAt: Date;
}

// ============================================================================
// Source Configuration Types
// ============================================================================

export type AdapterType = 'json-feed' | 'csv-upload' | 'web-scraper' | 'api-feed' | string;

export interface SourceConfig {
  id: string;
  organizationId: string;
  name: string;
  adapterType: AdapterType;
  sourceUrl?: string;
  adapterConfig: Record<string, unknown>;
  isActive: boolean;
  lastFetchedAt?: Date;
  nextFetchAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SourceMetadata {
  name: string;
  version: string;
  description: string;
  config: {
    enabled: boolean;
    timeout: number;
    retryCount: number;
  };
}

// ============================================================================
// Error Types
// ============================================================================

export class AdapterError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AdapterError';
  }
}

export class ConflictDetectionError extends Error {
  constructor(message: string, public details?: Record<string, unknown>) {
    super(message);
    this.name = 'ConflictDetectionError';
  }
}

export class NormalizationError extends Error {
  constructor(message: string, public details?: Record<string, unknown>) {
    super(message);
    this.name = 'NormalizationError';
  }
}
