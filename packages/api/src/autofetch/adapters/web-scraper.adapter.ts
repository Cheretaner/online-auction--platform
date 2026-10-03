import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import type { LookupFunction } from 'node:net';
import type { IncomingMessage } from 'node:http';
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

type FieldName = 'title' | 'description' | 'estimatedValue' | 'categoryName' | 'region' | 'city' | 'quantity' | 'unit' | 'condition' | 'externalId';

interface WebScraperConfig {
  url?: string;
  mappings?: Partial<Record<FieldName, string>>;
}

const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const ALLOWED_FIELDS = new Set<FieldName>([
  'title', 'description', 'estimatedValue', 'categoryName', 'region', 'city', 'quantity', 'unit', 'condition', 'externalId',
]);

/**
 * Imports explicitly published Schema.org Product/Vehicle records from one
 * public HTML page. It does not execute JavaScript or infer auction facts.
 * Every result stays in the administrator review queue.
 */
export class WebScraperAdapter implements ISourceAdapter {
  private config: WebScraperConfig = {};

  create(): ISourceAdapter { return new WebScraperAdapter(); }

  configure(config: Record<string, unknown>): void {
    this.config = {
      url: typeof config.url === 'string' ? config.url : undefined,
      mappings: this.readMappings(config.mappings),
    };
  }

  getMetadata(): SourceMetadata {
    return {
      name: 'web-scraper',
      version: '1.0.0',
      description: 'Imports Schema.org structured records from a public HTML page using explicit field mappings',
      config: { enabled: true, timeout: 15000, retryCount: 0 },
    };
  }

  async validateConfig(config: Record<string, unknown>): Promise<void> {
    this.validateUrl(typeof config.url === 'string' ? config.url : '');
    this.readMappings(config.mappings);
  }

  async fetchItems(_query: string, options: FetchOptions): Promise<SourceFetch[]> {
    if (!this.config.url) throw new AdapterError('Adapter not configured with URL', 'CONFIG_INVALID');
    const timeoutMs = Math.min(Math.max(options.timeout ?? 15000, 1000), 30000);
    try {
      const url = this.validateUrl(this.config.url);
      const html = await this.download(url, timeoutMs, 0);
      const records = this.extractRecords(html, url.href);
      return records.map((metadata, index) => {
        const externalId = String(metadata.externalId ?? `${url.href}#${index + 1}`);
        return {
          id: `web-scraper:${externalId}`,
          externalId,
          title: String(metadata.title ?? `Structured record ${index + 1}`),
          description: typeof metadata.description === 'string' ? metadata.description : undefined,
          metadata,
          source: 'web-scraper',
          fetchedAt: new Date(),
        };
      });
    } catch (error) {
      if (error instanceof AdapterError) throw error;
      throw new AdapterError(`Failed to fetch structured web source: ${error instanceof Error ? error.message : String(error)}`, 'FETCH_FAILED');
    }
  }

  async normalize(raw: unknown): Promise<NormalizedItem> {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new NormalizationError('Web source record must be an object');
    }
    const item = raw as Record<string, unknown>;
    const title = this.string(item.title);
    if (!title) throw new NormalizationError('Mapped title is missing; configure mappings.title for this website');
    return {
      title,
      description: this.string(item.description),
      quantity: this.number(item.quantity) ?? 1,
      unit: this.string(item.unit),
      estimatedValue: this.number(item.estimatedValue),
      categoryName: this.string(item.categoryName),
      condition: this.string(item.condition),
      region: this.string(item.region),
      city: this.string(item.city),
      externalId: this.string(item.externalId) ?? String(item.sourceUrl ?? title),
      externalSource: 'web-scraper',
      rawMetadata: item,
    };
  }

  scoreConfidence(item: NormalizedItem): ConfidenceScore {
    const rationale: string[] = [];
    const titleQuality = item.title.length > 10 ? 100 : 70;
    const descriptionQuality = item.description ? 80 : 15;
    const valueQuality = item.estimatedValue && item.estimatedValue > 0 ? 90 : 20;
    const categoryQuality = item.categoryName ? 70 : 20;
    const locationQuality = item.region && item.city ? 80 : item.region ? 55 : 20;
    if (!item.description) rationale.push('Description needs review');
    if (!item.estimatedValue) rationale.push('Estimated value needs review');
    if (!item.categoryName) rationale.push('Category needs review');
    if (!item.region) rationale.push('Region needs review');
    rationale.push('Imported web data must be checked against the original notice');
    return {
      overall: Math.round((titleQuality + descriptionQuality + valueQuality + categoryQuality + locationQuality) / 5),
      titleQuality, descriptionQuality, valueQuality, categoryQuality, locationQuality, rationale,
    };
  }

  isStale(): boolean { return false; }

  private validateUrl(value: string): URL {
    let url: URL;
    try { url = new URL(value); } catch { throw new Error('A public HTTP(S) page URL is required'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash ||
        (url.port && !((url.protocol === 'http:' && url.port === '80') || (url.protocol === 'https:' && url.port === '443')))) {
      throw new Error('Source URL must be a public HTTP(S) page without credentials or a nonstandard port');
    }
    const hostname = this.hostname(url);
    if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
      throw new Error('Source URL must use a public hostname');
    }
    if (isIP(hostname) && !this.isPublicIp(hostname)) throw new Error('Source URL resolves to a private or reserved address');
    return url;
  }

  private async download(url: URL, timeoutMs: number, redirects: number): Promise<string> {
    if (redirects > MAX_REDIRECTS) throw new AdapterError('Too many redirects from web source', 'FETCH_FAILED');
    const hostname = this.hostname(url);
    const addresses = isIP(hostname)
      ? [{ address: hostname, family: isIP(hostname) }]
      : await dnsLookup(hostname, { all: true, verbatim: true });
    if (addresses.length === 0 || addresses.some(({ address }) => !this.isPublicIp(address))) {
      throw new AdapterError('Web source hostname resolves to a private or reserved address', 'URL_BLOCKED');
    }
    // Pin the request to the address checked above. This prevents DNS rebinding
    // between validation and connection. Redirects are revalidated separately.
    const address = addresses[0]!;
    const pinnedLookup = ((_: string, __: unknown, callback: (error: NodeJS.ErrnoException | null, address: string, family: number) => void) => {
      callback(null, address.address, address.family);
    }) as LookupFunction;
    const request = (url.protocol === 'https:' ? httpsRequest : httpRequest);
    const response = await new Promise<IncomingMessage>((resolve, reject) => {
      const req = request(url, {
        method: 'GET',
        lookup: pinnedLookup,
        servername: isIP(hostname) ? undefined : hostname,
        headers: {
          Accept: 'text/html, application/xhtml+xml;q=0.9',
          'Accept-Encoding': 'identity',
          'User-Agent': 'Cheretanet-Auction-NoticeImporter/1.0',
        },
      }, resolve);
      req.setTimeout(timeoutMs, () => req.destroy(new Error('Web source request timed out')));
      req.once('error', reject);
      req.end();
    });

    const status = response.statusCode ?? 0;
    if ([301, 302, 303, 307, 308].includes(status)) {
      const location = response.headers.location;
      response.resume();
      if (!location) throw new AdapterError('Web source redirect omitted its target', 'FETCH_FAILED');
      const next = this.validateUrl(new URL(location, url).href);
      return this.download(next, timeoutMs, redirects + 1);
    }
    if (status < 200 || status >= 300) {
      response.resume();
      throw new AdapterError(`Web source returned HTTP ${status}`, 'FETCH_FAILED', { status });
    }
    const contentType = response.headers['content-type']?.toLowerCase() ?? '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      response.resume();
      throw new AdapterError('Web source must return HTML', 'INVALID_FORMAT');
    }
    return new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = [];
      let bytes = 0;
      response.on('data', (chunk: Buffer | string) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        bytes += buffer.length;
        if (bytes > MAX_HTML_BYTES) {
          response.destroy(new Error('Web source HTML exceeds the 2 MB limit'));
          reject(new AdapterError('Web source HTML exceeds the 2 MB limit', 'RESPONSE_TOO_LARGE'));
          return;
        }
        chunks.push(buffer);
      });
      response.once('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      response.once('error', reject);
    });
  }

  private extractRecords(html: string, sourceUrl: string): Array<Record<string, unknown>> {
    const structured: unknown[] = [];
    for (const match of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi)) {
      try { structured.push(JSON.parse(match[1]!.trim())); } catch { /* Ignore malformed blocks; other blocks may still be usable. */ }
    }
    const products = this.findProducts(structured);
    const inputs = products.length ? products : [this.readOpenGraph(html)].filter((value): value is Record<string, unknown> => Boolean(value));
    return inputs.map((record) => {
      const mapped: Record<string, unknown> = {};
      for (const field of ALLOWED_FIELDS) {
        const configuredPath = this.config.mappings?.[field];
        const defaults = this.defaultPaths(field);
        const value = configuredPath ? this.pathValue(record, configuredPath) : this.firstValue(record, defaults);
        if (value !== undefined && value !== null) mapped[field] = value;
      }
      mapped.sourceUrl = sourceUrl;
      mapped.sourceData = record;
      return mapped;
    }).filter((item) => Boolean(this.string(item.title)));
  }

  private findProducts(roots: unknown[]): Record<string, unknown>[] {
    const found: Record<string, unknown>[] = [];
    const seen = new Set<object>();
    const visit = (value: unknown, depth: number): void => {
      if (depth > 12 || !value || typeof value !== 'object') return;
      if (seen.has(value)) return;
      seen.add(value);
      if (Array.isArray(value)) { for (const entry of value) visit(entry, depth + 1); return; }
      const record = value as Record<string, unknown>;
      const types = Array.isArray(record['@type']) ? record['@type'] : [record['@type']];
      if (types.some((type) => typeof type === 'string' && /^(Product|IndividualProduct|ProductGroup|Vehicle|RealEstateListing)$/i.test(type.split('/').pop()!.split(':').pop()!))) {
        found.push(record);
        return;
      }
      for (const child of Object.values(record)) visit(child, depth + 1);
    };
    for (const root of roots) visit(root, 0);
    return found.slice(0, 100);
  }

  private readOpenGraph(html: string): Record<string, unknown> | undefined {
    const tags = [...html.matchAll(/<meta\b[^>]*>/gi)].map((match) => match[0]);
    const values = new Map<string, string>();
    for (const tag of tags) {
      const key = this.attribute(tag, 'property') ?? this.attribute(tag, 'name');
      const value = this.attribute(tag, 'content');
      if (key && value) values.set(key.toLowerCase(), this.decodeHtml(value));
    }
    const title = values.get('og:title') ?? values.get('twitter:title');
    if (!title) return undefined;
    const product: Record<string, unknown> = { name: title };
    const description = values.get('og:description') ?? values.get('description');
    const price = values.get('product:price:amount');
    const category = values.get('product:category');
    if (description) product.description = description;
    if (price) product.offers = { price };
    if (category) product.category = category;
    return product;
  }

  private defaultPaths(field: FieldName): string[] {
    const paths: Partial<Record<FieldName, string[]>> = {
      title: ['name', 'headline'],
      description: ['description'],
      estimatedValue: ['offers.price', 'offers.0.price', 'price', 'estimatedValue'],
      categoryName: ['category'],
      region: ['address.addressRegion', 'areaServed.name', 'location.address.addressRegion'],
      city: ['address.addressLocality', 'location.address.addressLocality'],
      quantity: ['inventoryLevel.value', 'quantity'],
      unit: ['unitText'],
      condition: ['itemCondition'],
      externalId: ['sku', 'productID', '@id', 'url', 'identifier.value'],
    };
    return paths[field] ?? [];
  }

  private firstValue(record: Record<string, unknown>, paths: string[]): unknown {
    for (const path of paths) {
      const value = this.pathValue(record, path);
      if (value !== undefined && value !== null && value !== '') return value;
    }
    return undefined;
  }

  private pathValue(record: Record<string, unknown>, path: string): unknown {
    let current: unknown = record;
    for (const part of path.replace(/^\$\.?/, '').split('.').filter(Boolean)) {
      const arrayIndex = part.match(/^(.*)\[(\d+)\]$/);
      const key = arrayIndex?.[1] ?? part;
      if (Array.isArray(current)) {
        const index = arrayIndex ? Number(arrayIndex[2]) : 0;
        current = current[index];
      } else if (current && typeof current === 'object') {
        current = (current as Record<string, unknown>)[key];
        if (Array.isArray(current) && !arrayIndex) current = current[0];
      } else return undefined;
    }
    if (current && typeof current === 'object' && !Array.isArray(current)) {
      const nested = current as Record<string, unknown>;
      return nested.name ?? nested.value ?? nested['@id'];
    }
    return current;
  }

  private readMappings(value: unknown): Partial<Record<FieldName, string>> {
    if (value === undefined) return {};
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('mappings must be an object of field names to JSON-LD paths');
    const mappings: Partial<Record<FieldName, string>> = {};
    for (const [key, path] of Object.entries(value as Record<string, unknown>)) {
      if (!ALLOWED_FIELDS.has(key as FieldName)) throw new Error(`Unsupported web-scraper mapping field: ${key}`);
      if (typeof path !== 'string' || !path.trim() || path.length > 200 || /[\[\]();{}]/.test(path.replace(/\[\d+\]/g, ''))) {
        throw new Error(`Mapping for ${key} must be a simple dotted JSON-LD path`);
      }
      mappings[key as FieldName] = path.trim();
    }
    return mappings;
  }

  private isPublicIp(address: string): boolean {
    if (isIP(address) === 4) {
      const octets = address.split('.').map(Number);
      const [a, b, c] = octets;
      if (a === undefined || b === undefined || c === undefined) return false;
      return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
        (a === 100 && b! >= 64 && b! <= 127) ||
        (a === 169 && b === 254) || (a === 172 && b! >= 16 && b! <= 31) ||
        (a === 192 && (b === 168 || (b === 0 && c === 0) || (b === 0 && c === 2) || (b === 88 && c === 99))) ||
        (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
        (a === 203 && b === 0 && c === 113) || a === 255);
    }
    if (isIP(address) !== 6) return false;
    const words = this.ipv6Words(address);
    if (!words) return false;
    const value = words.reduce((total, word) => (total << 16n) | BigInt(word), 0n);
    const prefix = (bits: number, expected: bigint) => (value >> BigInt(128 - bits)) === expected;
    if (value === 0n || value === 1n || !prefix(3, 1n) || prefix(7, 0x7en) || prefix(10, 0x3fan) || prefix(8, 0xffn) || prefix(32, 0x20010db8n) ||
        (words[0] === 0x2001 && words[1]! <= 0x01ff) || words[0] === 0x2002) return false;
    if (words.slice(0, 5).every((word) => word === 0) && words[5] === 0xffff) {
      const embeddedV4 = `${words[6]! >> 8}.${words[6]! & 255}.${words[7]! >> 8}.${words[7]! & 255}`;
      return this.isPublicIp(embeddedV4);
    }
    return true;
  }

  private ipv6Words(address: string): number[] | undefined {
    let input = address.toLowerCase().split('%')[0]!;
    const lastColon = input.lastIndexOf(':');
    if (input.includes('.')) {
      const ipv4 = input.slice(lastColon + 1).split('.').map(Number);
      if (ipv4.length !== 4 || ipv4.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return undefined;
      input = `${input.slice(0, lastColon + 1)}${((ipv4[0]! << 8) | ipv4[1]!).toString(16)}:${((ipv4[2]! << 8) | ipv4[3]!).toString(16)}`;
    }
    const halves = input.split('::');
    if (halves.length > 2) return undefined;
    const left = halves[0] ? halves[0].split(':') : [];
    const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
    const zeros = halves.length === 2 ? 8 - left.length - right.length : 0;
    const parts = [...left, ...Array(Math.max(0, zeros)).fill('0'), ...right];
    if (parts.length !== 8 || parts.some((part) => !/^[\da-f]{1,4}$/.test(part))) return undefined;
    return parts.map((part) => parseInt(part, 16));
  }

  private hostname(url: URL): string { return url.hostname.replace(/^\[|\]$/g, '').toLowerCase(); }
  private attribute(tag: string, name: string): string | undefined {
    const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, 'i'));
    return match?.[2];
  }
  private decodeHtml(value: string): string {
    return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (_match, entity: string) => {
      const lower = entity.toLowerCase();
      if (lower.startsWith('#x')) return String.fromCodePoint(parseInt(lower.slice(2), 16));
      if (lower.startsWith('#')) return String.fromCodePoint(parseInt(lower.slice(1), 10));
      return ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' } as Record<string, string>)[lower] ?? _match;
    });
  }
  private string(value: unknown): string | undefined {
    if (typeof value === 'string') return value.trim() || undefined;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return undefined;
  }
  private number(value: unknown): number | undefined {
    const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.replace(/[^\d.-]/g, '')) : Number.NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  }
}
