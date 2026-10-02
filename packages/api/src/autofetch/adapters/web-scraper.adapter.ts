/**
 * Web Scraper Adapter
 * Fetches HTML from a URL, strips tags, and uses AI to extract auction listings.
 */

import type { ISourceAdapter } from './adapter.interface.js';
import {
  SourceFetch,
  NormalizedItem,
  ConfidenceScore,
  SourceMetadata,
  FetchOptions,
  AdapterError,
  NormalizationError,
} from '../types/index.js';
import { aiProviderAdapter, parseJsonLoose } from '../../infrastructure/ai/provider.adapter.js';

interface WebScraperConfig {
  url?: string;
}

export class WebScraperAdapter implements ISourceAdapter {
  private config: WebScraperConfig = {};

  configure(config: Record<string, unknown>): void {
    this.config = config as WebScraperConfig;
  }

  create(): ISourceAdapter {
    return new WebScraperAdapter();
  }

  getMetadata(): SourceMetadata {
    return {
      name: 'web-scraper',
      version: '1.0.0',
      description: 'Scrapes web pages and extracts auction items using AI',
      config: {
        enabled: true,
        timeout: 30000,
        retryCount: 3,
      },
    };
  }

  async validateConfig(config: Record<string, unknown>): Promise<void> {
    const webConfig = config as unknown as WebScraperConfig;

    if (!webConfig.url) {
      throw new Error('url is required for web-scraper adapter');
    }

    try {
      const url = new URL(webConfig.url);
      const host = url.hostname.toLowerCase();
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
          host === 'localhost' || host.endsWith('.localhost') ||
          /^(127\.|10\.|192\.168\.|169\.254\.|0\.|::1$|fc|fd)/i.test(host)) {
        throw new Error('URL must be a public HTTP(S) endpoint');
      }
    } catch {
      throw new Error(`Invalid URL: ${webConfig.url}`);
    }
  }

  async fetchItems(
    _query: string,
    options: FetchOptions
  ): Promise<SourceFetch[]> {
    if (!this.config.url) {
      throw new AdapterError('Adapter not configured with URL', 'CONFIG_INVALID');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      options.timeout || 30000
    );

    try {
      const response = await fetch(this.config.url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5'
        }
      });

      if (!response.ok) {
        throw new AdapterError(
          `HTTP ${response.status}: ${response.statusText}`,
          'FETCH_FAILED',
          { url: this.config.url, status: response.status }
        );
      }

      const html = await response.text();
      
      let text = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (text.length > 10000) {
        text = text.substring(0, 10000);
      }

      const prompt = `You are an auction data extraction specialist for Ethiopian auctions.
Extract all auction item listings from the following web page text.
Return a JSON array where each object has these fields:
- title: string (the auction item or lot title)
- description: string (item description, condition, details)
- estimatedValue: number or null (starting price or estimated value in Ethiopian Birr)
- category: string or null (item category like vehicles, property, electronics, machinery)
- location: string or null (city or region where the auction takes place)
- deadline: string or null (auction deadline or closing date)
- organizerName: string or null (who is conducting the auction)
- organizerContact: string or null (phone number, email, or website to contact)

If no auction items are found, return an empty array [].
Only return valid JSON, no markdown fences, no explanations.

Web page text:
---
${text}
---`;

      const aiResponse = await aiProviderAdapter.assist(prompt);
      
      if (aiResponse.fallback) {
        throw new AdapterError('AI provider is temporarily unavailable (high demand), cannot extract auction items.', 'AI_UNAVAILABLE');
      }

      let items: any[] = [];
      try {
        items = parseJsonLoose<any[]>(aiResponse.answer);
      } catch (err) {
        throw new AdapterError('Failed to parse AI response into JSON array', 'PARSE_FAILED', { originalError: err });
      }

      if (!Array.isArray(items)) {
        throw new AdapterError('Expected AI to return an array of items', 'INVALID_FORMAT');
      }

      return items.map((item, index) => {
        const id = item.title ? String(item.title).replace(/[^a-z0-9]/gi, '-').toLowerCase() : `item-${index}`;
        return {
          id: `web-scraper:${index}:${id}`,
          externalId: id,
          title: String(item.title || `Item ${index + 1}`),
          description: typeof item.description === 'string' ? item.description : undefined,
          metadata: item,
          source: 'web-scraper',
          fetchedAt: new Date(),
        };
      });
    } catch (error) {
      if (error instanceof AdapterError) throw error;
      throw new AdapterError(
        `Failed to fetch from web scraper: ${error instanceof Error ? error.message : String(error)}`,
        'FETCH_FAILED',
        { originalError: error }
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async normalize(raw: unknown): Promise<NormalizedItem> {
    try {
      const item = raw as Record<string, unknown>;
      const externalId = typeof item.externalId === 'string' ? item.externalId : String(Date.now());
      const metadata = (item.metadata as Record<string, unknown>) || item;

      let estimatedValue: number | undefined;
      if (typeof metadata.estimatedValue === 'number') {
        estimatedValue = metadata.estimatedValue;
      } else if (typeof metadata.estimatedValue === 'string') {
        const parsed = parseFloat(metadata.estimatedValue);
        if (!isNaN(parsed) && parsed > 0) estimatedValue = parsed;
      }

      return {
        title: typeof item.title === 'string' ? item.title.trim() : typeof metadata.title === 'string' ? metadata.title.trim() : 'Unknown Item',
        description: typeof item.description === 'string' ? item.description.trim() : typeof metadata.description === 'string' ? metadata.description.trim() : undefined,
        quantity: 1,
        estimatedValue,
        categoryName: typeof metadata.category === 'string' && metadata.category.trim().length > 0 ? metadata.category.trim() : undefined,
        region: typeof metadata.location === 'string' && metadata.location.trim().length > 0 ? metadata.location.trim() : undefined,
        externalId: externalId,
        externalSource: 'web-scraper',
        rawMetadata: metadata,
      };
    } catch (error) {
      throw new NormalizationError(
        `Failed to normalize web scraper item: ${error instanceof Error ? error.message : String(error)}`,
        { originalError: error }
      );
    }
  }

  scoreConfidence(item: NormalizedItem): ConfidenceScore {
    const rationale: string[] = [];
    let totalScore = 0;
    let fieldCount = 0;

    const titleQuality = item.title && item.title.length > 10 ? 100 : item.title ? 70 : 0;
    totalScore += titleQuality;
    fieldCount++;
    if (titleQuality < 100) rationale.push('Title is short or missing');

    const descriptionQuality = item.description ? 80 : 20;
    totalScore += descriptionQuality;
    fieldCount++;
    if (!item.description) rationale.push('No description provided');

    const valueQuality = item.estimatedValue && item.estimatedValue > 0 ? 90 : 30;
    totalScore += valueQuality;
    fieldCount++;
    if (!item.estimatedValue) rationale.push('Estimated value missing');

    const categoryQuality = item.categoryName ? 80 : 30;
    totalScore += categoryQuality;
    fieldCount++;
    if (!item.categoryName) rationale.push('No category provided');

    const locationQuality = item.region ? 80 : 30;
    totalScore += locationQuality;
    fieldCount++;
    if (!item.region) rationale.push('Location/Region missing');

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

  isStale(_item: NormalizedItem): boolean {
    return false;
  }
}
