/**
 * JSON Feed Adapter
 * Parses JSON API responses or static JSON files
 * Maps external JSON structure to internal AuctionItem model
 */

import { ISourceAdapter } from './adapter.interface.js';
import {
  SourceFetch,
  NormalizedItem,
  ConfidenceScore,
  SourceMetadata,
  FetchOptions,
  AdapterError,
  NormalizationError,
} from '../types/index.js';

interface JsonFeedConfig {
  url?: string;
  apiKey?: string;
  itemsPath?: string; // JSON path to items array, e.g. "data.items"
  mappings?: Record<string, string>; // Field mappings
}

export class JsonFeedAdapter implements ISourceAdapter {
  private config: JsonFeedConfig = {};

  configure(config: Record<string, unknown>): void {
    this.config = config as JsonFeedConfig;
  }

  create(): ISourceAdapter {
    return new JsonFeedAdapter();
  }

  getMetadata(): SourceMetadata {
    return {
      name: 'json-feed',
      version: '1.0.0',
      description: 'Fetches auction data from JSON APIs or feeds',
      config: {
        enabled: true,
        timeout: 30000,
        retryCount: 3,
      },
    };
  }

  async validateConfig(config: Record<string, unknown>): Promise<void> {
    const jsonConfig = config as unknown as JsonFeedConfig;

    if (!jsonConfig.url) {
      throw new Error('url is required for json-feed adapter');
    }

    // Try to validate URL format
    try {
      const url = new URL(jsonConfig.url);
      const host = url.hostname.toLowerCase();
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
          host === 'localhost' || host.endsWith('.localhost') ||
          /^(127\.|10\.|192\.168\.|169\.254\.|0\.|::1$|fc|fd)/i.test(host)) {
        throw new Error('URL must be a public HTTP(S) endpoint');
      }
    } catch {
      throw new Error(`Invalid URL: ${jsonConfig.url}`);
    }
  }

  async fetchItems(
    _query: string,
    options: FetchOptions
  ): Promise<SourceFetch[]> {
    try {
      if (!this.config.url) {
        throw new Error('Adapter not configured with URL');
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        options.timeout || 30000
      );

      const response = await fetch(this.config.url, {
        signal: controller.signal,
        headers: this.config.apiKey
          ? { Authorization: `Bearer ${this.config.apiKey}` }
          : {},
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new AdapterError(
          `HTTP ${response.status}: ${response.statusText}`,
          'FETCH_FAILED',
          { url: this.config.url, status: response.status }
        );
      }

      const data = await response.json();

      // Extract items array from JSON path
      const items = this.extractItems(data);

      if (!Array.isArray(items)) {
        throw new AdapterError(
          'Expected array of items in response',
          'INVALID_FORMAT',
          { itemsPath: this.config.itemsPath }
        );
      }

      return items.map((item, index) => {
        const record = this.asRecord(item);
        return {
        id: `json-feed:${index}:${record.id ?? index}`,
        externalId: String(record.id ?? index),
        title: String(record.title ?? `Item ${index}`),
        description: typeof record.description === 'string' ? record.description : undefined,
        metadata: record,
        source: 'json-feed',
        fetchedAt: new Date(),
        };
      });
    } catch (error) {
      if (error instanceof AdapterError) throw error;

      throw new AdapterError(
        `Failed to fetch JSON feed: ${error instanceof Error ? error.message : String(error)}`,
        'FETCH_FAILED',
        { originalError: error }
      );
    }
  }

  async normalize(raw: unknown): Promise<NormalizedItem> {
    try {
      const item = raw as Record<string, unknown>;

      // Apply field mappings if configured
      const mapped = this.applyMappings(item);

      return {
        title: this.normalizeString(mapped.title || item.title, 'title'),
        description: this.normalizeOptionalString(
          mapped.description || item.description
        ),
        quantity: this.normalizeNumber(mapped.quantity || item.quantity || 1),
        unit: this.normalizeOptionalString(mapped.unit || item.unit),
        estimatedValue: this.normalizeOptionalNumber(
          mapped.estimatedValue || item.value || item.estimate || item.price
        ),
        categoryId: undefined, // Will be assigned by AI
        categoryName: this.normalizeOptionalString(
          mapped.categoryName || item.category || item.categoryName
        ),
        condition: this.normalizeOptionalString(
          mapped.condition || item.condition
        ),
        region: this.normalizeOptionalString(
          mapped.region || item.region || item.location
        ),
        city: this.normalizeOptionalString(mapped.city || item.city),
        externalId: String(item.id || ''),
        externalSource: 'json-feed',
        rawMetadata: item,
      };
    } catch (error) {
      throw new NormalizationError(
        `Failed to normalize JSON item: ${error instanceof Error ? error.message : String(error)}`,
        { originalError: error }
      );
    }
  }

  scoreConfidence(item: NormalizedItem): ConfidenceScore {
    const rationale: string[] = [];
    let totalScore = 0;
    let fieldCount = 0;

    // Title quality (mandatory, always present in normalize)
    const titleQuality =
      item.title && item.title.length > 10 ? 100 : item.title ? 70 : 0;
    totalScore += titleQuality;
    fieldCount++;
    if (titleQuality < 100) rationale.push('Title is short or missing');

    // Description quality (optional but valuable)
    const descriptionQuality = item.description ? 85 : 10;
    totalScore += descriptionQuality;
    fieldCount++;
    if (!item.description) rationale.push('No description provided');

    // Value quality (important for auction)
    const valueQuality =
      item.estimatedValue && item.estimatedValue > 0 ? 95 : 20;
    totalScore += valueQuality;
    fieldCount++;
    if (!item.estimatedValue) rationale.push('Estimated value missing');

    // Category quality (helps with AI suggestions)
    const categoryQuality = item.categoryName ? 75 : 15;
    totalScore += categoryQuality;
    fieldCount++;
    if (!item.categoryName) rationale.push('No category provided');

    // Location quality (important for discovery)
    const locationQuality =
      item.region && item.city ? 90 : item.region ? 60 : 20;
    totalScore += locationQuality;
    fieldCount++;
    if (!item.region) rationale.push('Region missing');

    const overall = Math.round(totalScore / fieldCount);

    return {
      overall,
      titleQuality,
      descriptionQuality,
      valueQuality,
      categoryQuality,
      locationQuality,
      rationale,
    };
  }

  isStale(item: NormalizedItem): boolean {
    // Mark as stale if critical fields missing
    if (!item.description) return true;
    if (!item.estimatedValue || item.estimatedValue <= 0) return true;
    if (!item.region) return true;

    return false;
  }

  // ========================================================================
  // Private Helpers
  // ========================================================================

  private extractItems(data: unknown): unknown[] {
    if (Array.isArray(data)) {
      return data;
    }

    // Try itemsPath
    if (this.config.itemsPath) {
      const keys = this.config.itemsPath.split('.');
      let current: unknown = data;

      for (const key of keys) {
        if (typeof current === 'object' && current !== null) {
          current = (current as Record<string, unknown>)[key];
        } else {
          return [];
        }
      }

      if (Array.isArray(current)) {
        return current;
      }
    }

    // Try common paths
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.items)) return obj.items;
    if (Array.isArray(obj.data)) return obj.data;
    if (Array.isArray(obj.results)) return obj.results;

    return [];
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new AdapterError('Feed items must be JSON objects', 'INVALID_FORMAT');
    }
    return value as Record<string, unknown>;
  }

  private applyMappings(
    item: Record<string, unknown>
  ): Record<string, unknown> {
    if (!this.config.mappings) {
      return item;
    }

    const mapped: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(this.config.mappings)) {
      mapped[key] = item[value as keyof typeof item];
    }

    return { ...item, ...mapped };
  }

  private normalizeString(value: unknown, fieldName: string): string {
    if (typeof value === 'string') {
      return value.trim();
    }

    if (value === null || value === undefined) {
      throw new NormalizationError(`${fieldName} is required but missing`);
    }

    return String(value).trim();
  }

  private normalizeOptionalString(value: unknown): string | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }

    return String(value).trim();
  }

  private normalizeNumber(value: unknown): number {
    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      if (!isNaN(parsed)) {
        return parsed;
      }
    }

    return 1;
  }

  private normalizeOptionalNumber(value: unknown): number | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }

    if (typeof value === 'number') {
      return value > 0 ? value : undefined;
    }

    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return !isNaN(parsed) && parsed > 0 ? parsed : undefined;
    }

    return undefined;
  }
}
