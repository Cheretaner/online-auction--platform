import type { ISourceAdapter } from './adapter.interface.js';
import {
  AdapterError,
  NormalizationError,
  type ConfidenceScore,
  type FetchOptions,
  type NormalizedItem,
  type SourceFetch,
  type SourceMetadata,
} from '../types/index.js';

export class RssFeedAdapter implements ISourceAdapter {
  private config: { url?: string } = {};

  create(): ISourceAdapter { return new RssFeedAdapter(); }
  configure(config: Record<string, unknown>): void { this.config = { url: typeof config.url === 'string' ? config.url : undefined }; }

  getMetadata(): SourceMetadata {
    return { name: 'rss-feed', version: '1.0.0', description: 'Imports public RSS or Atom feeds, including social feed bridges', config: { enabled: true, timeout: 30000, retryCount: 3 } };
  }

  async validateConfig(config: Record<string, unknown>): Promise<void> {
    const url = typeof config.url === 'string' ? config.url : '';
    let parsed: URL;
    try { parsed = new URL(url); } catch { throw new Error('A public RSS/Atom URL is required'); }
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('RSS URL must use HTTP(S)');
  }

  async fetchItems(_query: string, options: FetchOptions): Promise<SourceFetch[]> {
    if (!this.config.url) throw new AdapterError('Adapter not configured with URL', 'CONFIG_INVALID');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout ?? 30000);
    try {
      const response = await fetch(this.config.url, { signal: controller.signal, headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' } });
      if (!response.ok) throw new AdapterError(`HTTP ${response.status}: ${response.statusText}`, 'FETCH_FAILED');
      return this.parse(await response.text());
    } catch (error) {
      if (error instanceof AdapterError) throw error;
      throw new AdapterError(`Failed to fetch RSS feed: ${error instanceof Error ? error.message : String(error)}`, 'FETCH_FAILED');
    } finally { clearTimeout(timeoutId); }
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
      const value = (name: string) => entry.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'))?.[1]?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '').trim();
      const link = value('link') ?? entry.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1];
      const title = value('title') ?? `Feed item ${index + 1}`;
      const description = value('description') ?? value('summary');
      return { id: `rss-feed:${index}:${link ?? title}`, externalId: link ?? title, title, description, metadata: { id: link ?? title, title, description, link, category: value('category') }, source: 'rss-feed', fetchedAt: new Date() };
    });
  }

  private required(value: unknown): string { const result = this.optional(value); if (!result) throw new Error('title is required'); return result; }
  private optional(value: unknown): string | undefined { const result = typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim(); return result || undefined; }
  private number(value: unknown): number | undefined { const parsed = Number(value); return value == null || value === '' || !Number.isFinite(parsed) ? undefined : parsed; }
}
