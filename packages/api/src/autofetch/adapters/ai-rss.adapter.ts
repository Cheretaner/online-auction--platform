/**
 * AI RSS Adapter (for Telegram channels via RSS bridges)
 * Fetches RSS and uses AI to extract structured auction data from unstructured posts.
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
import { RssFeedAdapter } from './rss-feed.adapter.js';

interface AiRssConfig {
  url?: string;
}

export class AiRssAdapter implements ISourceAdapter {
  private config: AiRssConfig = {};
  private rssAdapter: RssFeedAdapter;

  constructor() {
    this.rssAdapter = new RssFeedAdapter();
  }

  configure(config: Record<string, unknown>): void {
    this.config = config as AiRssConfig;
    this.rssAdapter.configure(config);
  }

  create(): ISourceAdapter {
    return new AiRssAdapter();
  }

  getMetadata(): SourceMetadata {
    return {
      name: 'telegram-rss',
      version: '1.0.0',
      description: 'Fetches Telegram posts via RSS and extracts auction data using AI',
      config: {
        enabled: true,
        timeout: 60000,
        retryCount: 3,
      },
    };
  }

  async validateConfig(config: Record<string, unknown>): Promise<void> {
    await this.rssAdapter.validateConfig(config);
  }

  async fetchItems(
    query: string,
    options: FetchOptions
  ): Promise<SourceFetch[]> {
    const rawItems = await this.rssAdapter.fetchItems(query, options);
    const processedItems: SourceFetch[] = [];
    
    for (const item of rawItems) {
      const textToAnalyze = item.description || item.title || '';
      if (!textToAnalyze.trim()) {
        continue;
      }
      
      const prompt = `You are an Ethiopian auction data extraction specialist.
Extract auction details from this Telegram channel post. Posts may be in Amharic, English, or mixed.
Return a JSON object with these fields:
- title: string (the auction item or lot title)
- description: string (item description and details)
- estimatedValue: number or null (starting price in Ethiopian Birr)
- category: string or null (vehicles, property, electronics, machinery, etc.)
- location: string or null (city or region)
- deadline: string or null (auction date or deadline, ISO format if possible)
- organizerName: string or null (who posted the auction)
- organizerContact: string or null (phone, email, or website)

If this post is NOT about an auction, return null.
Only return valid JSON, no markdown, no explanations.

Telegram post:
---
${textToAnalyze}
---`;

      try {
        const aiResponse = await aiProviderAdapter.assist(prompt);
        
        if (aiResponse.fallback) {
          throw new AdapterError('AI provider is temporarily unavailable (high demand), cannot extract auction items.', 'AI_UNAVAILABLE');
        }

        const extractedData = parseJsonLoose<any>(aiResponse.answer);
        
        if (extractedData && typeof extractedData === 'object') {
          processedItems.push({
            id: `ai-rss:${item.id}`,
            externalId: item.externalId,
            title: typeof extractedData.title === 'string' ? extractedData.title : item.title,
            description: typeof extractedData.description === 'string' ? extractedData.description : item.description,
            metadata: {
              ...item.metadata,
              aiExtracted: extractedData,
            },
            source: 'telegram-rss',
            fetchedAt: item.fetchedAt,
          });
        }
      } catch (error) {
        // Skip items that AI fails to parse or identify as auctions
      }
    }
    
    return processedItems;
  }

  async normalize(raw: unknown): Promise<NormalizedItem> {
    try {
      const item = raw as Record<string, unknown>;
      const metadata = (item.metadata as Record<string, unknown>) || {};
      const aiData = (metadata.aiExtracted as Record<string, unknown>) || {};
      
      let estimatedValue: number | undefined;
      if (typeof aiData.estimatedValue === 'number') {
        estimatedValue = aiData.estimatedValue;
      } else if (typeof aiData.estimatedValue === 'string') {
        const parsed = parseFloat(aiData.estimatedValue);
        if (!isNaN(parsed) && parsed > 0) estimatedValue = parsed;
      }

      return {
        title: typeof aiData.title === 'string' && aiData.title.trim() ? aiData.title.trim() : typeof item.title === 'string' ? item.title.trim() : 'Unknown Auction',
        description: typeof aiData.description === 'string' && aiData.description.trim() ? aiData.description.trim() : typeof item.description === 'string' ? item.description.trim() : undefined,
        quantity: 1,
        estimatedValue,
        categoryName: typeof aiData.category === 'string' && aiData.category.trim() ? aiData.category.trim() : undefined,
        region: typeof aiData.location === 'string' && aiData.location.trim() ? aiData.location.trim() : undefined,
        externalId: typeof item.externalId === 'string' ? item.externalId : String(Date.now()),
        externalSource: 'telegram-rss',
        rawMetadata: metadata,
      };
    } catch (error) {
      throw new NormalizationError(
        `Failed to normalize AI RSS item: ${error instanceof Error ? error.message : String(error)}`,
        { originalError: error }
      );
    }
  }

  scoreConfidence(item: NormalizedItem): ConfidenceScore {
    const rationale: string[] = [];
    let totalScore = 0;
    let fieldCount = 0;

    const titleQuality = item.title && item.title.length > 10 ? 85 : item.title ? 60 : 0;
    totalScore += titleQuality;
    fieldCount++;
    if (titleQuality < 85) rationale.push('Title might be incomplete from Telegram post');

    const descriptionQuality = item.description ? 75 : 15;
    totalScore += descriptionQuality;
    fieldCount++;
    if (!item.description) rationale.push('No description extracted');

    const valueQuality = item.estimatedValue && item.estimatedValue > 0 ? 80 : 25;
    totalScore += valueQuality;
    fieldCount++;
    if (!item.estimatedValue) rationale.push('Estimated value missing from post');

    const categoryQuality = item.categoryName ? 70 : 20;
    totalScore += categoryQuality;
    fieldCount++;
    if (!item.categoryName) rationale.push('Category could not be determined');

    const locationQuality = item.region ? 75 : 20;
    totalScore += locationQuality;
    fieldCount++;
    if (!item.region) rationale.push('Location missing from post');

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
    const metadata = item.rawMetadata || {};
    const aiData = (metadata.aiExtracted as Record<string, unknown>) || {};
    
    if (typeof aiData.deadline === 'string') {
      const deadlineDate = new Date(aiData.deadline);
      if (!isNaN(deadlineDate.getTime())) {
        return deadlineDate.getTime() < Date.now();
      }
    }
    
    return false;
  }
}
