import type { ISourceAdapter } from './adapter.interface.js';
import { fetchPublicSource, validatePublicSourceUrl } from './public-http.js';
import {
  AdapterError,
  NormalizationError,
  type ConfidenceScore,
  type FetchOptions,
  type NormalizedItem,
  type SourceFetch,
  type SourceMetadata,
} from '../types/index.js';

function decodeEntities(value: string): string {
  const namedEntities: Record<string, string> = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"',
  };
  return value.replace(/&(#(?:x[\da-f]+|\d+)|[a-z]+);/gi, (entity, code: string) => {
    if (code[0] !== '#') return namedEntities[code.toLowerCase()] ?? entity;
    const hex = code[1]?.toLowerCase() === 'x';
    const point = Number.parseInt(code.slice(hex ? 2 : 1), hex ? 16 : 10);
    if (!Number.isInteger(point) || point < 0 || point > 0x10ffff || (point >= 0xd800 && point <= 0xdfff)) return '\uFFFD';
    return String.fromCodePoint(point);
  });
}

function plainFeedText(value: string | undefined): string | undefined {
  if (!value) return undefined;
  let text = value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  for (let pass = 0; pass < 3; pass += 1) {
    const decoded = decodeEntities(text);
    if (decoded === text) break;
    text = decoded;
  }
  text = text
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(?:nbsp|#160);/gi, ' ')
    .replace(/&(?:amp|lt|gt|quot|apos);/gi, (entity) => decodeEntities(entity))
    .replace(/\s+/g, ' ')
    .trim();
  return text ? text.slice(0, 20_000) : undefined;
}

export class RssFeedAdapter implements ISourceAdapter {
  private config: { url?: string; includeKeywords: string[] } = { includeKeywords: [] };

  create(): ISourceAdapter { return new RssFeedAdapter(); }
  configure(config: Record<string, unknown>): void {
    this.config = {
      url: typeof config.url === 'string' ? config.url : undefined,
      includeKeywords: this.readKeywords(config.includeKeywords),
    };
  }

  getMetadata(): SourceMetadata {
    return { name: 'rss-feed', version: '1.0.0', description: 'Imports public RSS or Atom feeds, including social feed bridges', config: { enabled: true, timeout: 30000, retryCount: 3 } };
  }

  async validateConfig(config: Record<string, unknown>): Promise<void> {
    const url = typeof config.url === 'string' ? config.url : '';
    validatePublicSourceUrl(url);
    this.readKeywords(config.includeKeywords);
  }

  async fetchItems(_query: string, options: FetchOptions): Promise<SourceFetch[]> {
    if (!this.config.url) throw new AdapterError('Adapter not configured with URL', 'CONFIG_INVALID');
    try {
      const response = await fetchPublicSource(this.config.url, {
        timeoutMs: Math.min(Math.max(options.timeout ?? 30_000, 1_000), 30_000),
        maxBytes: 5 * 1024 * 1024,
        acceptedContentType: (type) => !type || /xml|rss|atom|text\/plain/.test(type),
        headers: {
          Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml',
          'User-Agent': 'Cheretanet-Auction-SourceImporter/1.0',
        },
      });
      const items = this.parse(response.body.toString('utf8'));
      const matchingItems = this.config.includeKeywords.length === 0
        ? items
        : items.filter((item) => {
        const searchableText = `${item.title} ${item.description ?? ''}`.toLocaleLowerCase();
        return this.config.includeKeywords.every((keyword) => searchableText.includes(keyword));
      });
      return matchingItems.slice(0, Math.max(0, Math.min(options.limit ?? 100, 500)));
    } catch (error) {
      if (error instanceof AdapterError) throw error;
      throw new AdapterError(`Failed to fetch RSS feed: ${error instanceof Error ? error.message : String(error)}`, 'FETCH_FAILED');
    }
  }

  async normalize(raw: unknown): Promise<NormalizedItem> {
    try {
      const item = raw as Record<string, unknown>;
      return { title: this.required(item.title), description: this.optional(item.description), quantity: 1, estimatedValue: this.number(item.estimatedValue ?? item.price ?? item.value), categoryName: this.optional(item.category), region: this.optional(item.region ?? item.location), city: this.optional(item.city), externalId: String(item.id ?? item.link ?? item.title), externalSource: 'rss-feed', rawMetadata: item };
    } catch (error) { throw new NormalizationError(`Failed to normalize RSS item: ${error instanceof Error ? error.message : String(error)}`); }
  }

  scoreConfidence(item: NormalizedItem): ConfidenceScore {
    const rationale: string[] = [];
    const titleQuality = item.title.length > 10 ? 100 : 70;
    const descriptionQuality = item.description ? 80 : 15;
    const valueQuality = item.estimatedValue && item.estimatedValue > 0 ? 90 : 20;
    const categoryQuality = item.categoryName ? 70 : 20;
    const locationQuality = item.region ? 60 : 20;
    if (!item.description) rationale.push('Description needs review');
    if (!item.estimatedValue) rationale.push('Estimated value needs review');
    if (!item.region) rationale.push('Region needs review');
    return { overall: Math.round((titleQuality + descriptionQuality + valueQuality + categoryQuality + locationQuality) / 5), titleQuality, descriptionQuality, valueQuality, categoryQuality, locationQuality, rationale };
  }

  isStale(): boolean { return false; }

  private parse(xml: string): SourceFetch[] {
    const entries = [...xml.matchAll(/<(item|entry)\b[\s\S]*?<\/(item|entry)>/gi)].map((match) => match[0]);
    return entries.map((entry, index) => {
      const value = (name: string) => entry.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'))?.[1];
      const rawLink = value('link') ?? entry.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1];
      const link = plainFeedText(rawLink);
      const title = plainFeedText(value('title')) ?? `Feed item ${index + 1}`;
      const description = plainFeedText(value('description') ?? value('summary'));
      return { id: `rss-feed:${index}:${link ?? title}`, externalId: link ?? title, title, description, metadata: { id: link ?? title, title, description, link, category: plainFeedText(value('category')) }, source: 'rss-feed', fetchedAt: new Date() };
    });
  }

  private required(value: unknown): string { const result = this.optional(value); if (!result) throw new Error('title is required'); return result; }
  private optional(value: unknown): string | undefined { const result = typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim(); return result || undefined; }
  private number(value: unknown): number | undefined { const parsed = Number(value); return value == null || value === '' || !Number.isFinite(parsed) ? undefined : parsed; }
  private readKeywords(value: unknown): string[] {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.length > 20 || value.some((keyword) => typeof keyword !== 'string' || keyword.trim().length === 0 || keyword.length > 100)) {
      throw new Error('includeKeywords must contain up to 20 non-empty strings of at most 100 characters');
    }
    return [...new Set(value.map((keyword) => (keyword as string).trim().toLocaleLowerCase()))];
  }
}
