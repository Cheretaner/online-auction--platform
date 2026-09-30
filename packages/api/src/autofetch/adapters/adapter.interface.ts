/**
 * Source Adapter Interface
 * All external source adapters must implement this interface
 * Enables pluggable architecture for multiple data sources (APIs, scrapers, feeds, uploads)
 */

import {
  SourceFetch,
  NormalizedItem,
  ConfidenceScore,
  SourceMetadata,
  FetchOptions,
} from '../types/index.js';

export interface ISourceAdapter {
  /** Return an isolated adapter instance when configuration is stateful. */
  create?(): ISourceAdapter;
  configure?(config: Record<string, unknown>): void;
  /**
   * Adapter metadata (name, version, default config)
   */
  getMetadata(): SourceMetadata;

  /**
   * Fetch items from external source
   * Returns raw data before normalization
   *
   * @param query Search query or source identifier
   * @param options Fetch options (timeout, retry, limits)
   * @throws AdapterError on network/API failures
   */
  fetchItems(query: string, options: FetchOptions): Promise<SourceFetch[]>;

  /**
   * Normalize external data to internal AuctionItem shape
   * Converts field names, types, and units to match domain model
   *
   * @param raw Raw data from external source
   * @throws NormalizationError if data cannot be normalized
   */
  normalize(raw: unknown): Promise<NormalizedItem>;

  /**
   * Score how confident we are in the data quality
   * Considers completeness, field validity, source reliability
   *
   * @param item Normalized item to score
   * @returns Confidence score (0-100) with breakdown and rationale
   */
  scoreConfidence(item: NormalizedItem): ConfidenceScore;

  /**
   * Check if item is stale (e.g., past deadline, no longer relevant)
   *
   * @param item Normalized item to check
   * @returns true if item should be marked stale/expired
   */
  isStale(item: NormalizedItem): boolean;

  /**
   * Optional: Validate adapter config before use
   * Called when source is created or updated
   *
   * @param config Adapter-specific configuration
   * @throws Error if config is invalid
   */
  validateConfig?(config: Record<string, unknown>): Promise<void>;

  /**
   * Optional: Health check for the source
   * Called periodically to ensure source is reachable
   *
   * @throws Error if source is unreachable or in error state
   */
  healthCheck?(): Promise<void>;

  /**
   * Optional: Clean up resources (close connections, cancel requests)
   */
  cleanup?(): Promise<void>;
}
