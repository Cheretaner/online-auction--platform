# Source Adapters

This directory contains adapters for fetching auction data from external sources. Each adapter implements the `ISourceAdapter` interface and is registered with the `AdapterRegistry`.

## Architecture

```
External Source
      ↓
  Adapter.fetchItems()       ← Fetch raw data (API call, scrape, parse file)
      ↓
SourceFetch[] (raw data)
      ↓
  Adapter.normalize()        ← Map to AuctionItem shape, convert types/units
      ↓
NormalizedItem (internal model)
      ↓
  Adapter.scoreConfidence()  ← Assess data quality
      ↓
ConfidenceScore + NormalizedItem
      ↓
  [Conflict Detection, Review Queue, Admin Approval]
      ↓
  AuctionItem in database
```

## Implementing a New Adapter

### 1. Create Adapter File

File: `packages/api/src/autofetch/adapters/your-source.adapter.ts`

```typescript
import {
  ISourceAdapter,
  SourceFetch,
  NormalizedItem,
  ConfidenceScore,
  SourceMetadata,
  FetchOptions,
  AdapterError,
  NormalizationError,
} from '../types/index.js';

export class YourSourceAdapter implements ISourceAdapter {
  getMetadata(): SourceMetadata {
    return {
      name: 'your-source',
      version: '1.0.0',
      description: 'Fetches auction data from Your Source',
      config: {
        enabled: true,
        timeout: 30000,
        retryCount: 3,
      },
    };
  }

  async fetchItems(query: string, options: FetchOptions): Promise<SourceFetch[]> {
    try {
      // Call external API, scrape website, read file, etc.
      const raw = await this.callExternalSource(query, options);
      
      return raw.map((item) => ({
        id: `${this.getMetadata().name}:${item.id}`,
        externalId: item.id,
        title: item.title,
        description: item.description,
        metadata: item,
        source: this.getMetadata().name,
        fetchedAt: new Date(),
      }));
    } catch (error) {
      throw new AdapterError(
        `Failed to fetch from ${this.getMetadata().name}`,
        'FETCH_FAILED',
        { originalError: error }
      );
    }
  }

  async normalize(raw: unknown): Promise<NormalizedItem> {
    try {
      const item = raw as Record<string, unknown>;
      
      return {
        title: String(item.title || ''),
        description: item.description ? String(item.description) : undefined,
        quantity: Number(item.quantity || 1),
        unit: item.unit ? String(item.unit) : undefined,
        estimatedValue: item.value ? Number(item.value) : undefined,
        categoryId: undefined, // Will be matched by AI categorization
        categoryName: item.category ? String(item.category) : undefined,
        condition: item.condition ? String(item.condition) : undefined,
        region: item.region ? String(item.region) : undefined,
        city: item.city ? String(item.city) : undefined,
        externalId: String(item.id || ''),
        externalSource: this.getMetadata().name,
        rawMetadata: item,
      };
    } catch (error) {
      throw new NormalizationError(
        `Failed to normalize item from ${this.getMetadata().name}`,
        { originalError: error }
      );
    }
  }

  scoreConfidence(item: NormalizedItem): ConfidenceScore {
    const rationale: string[] = [];
    let totalScore = 0;
    let fieldCount = 0;

    // Title quality (mandatory, always present)
    const titleQuality = item.title && item.title.length > 10 ? 100 : 50;
    totalScore += titleQuality;
    fieldCount++;
    if (titleQuality < 100) rationale.push('Title is short or missing');

    // Description quality (optional but valuable)
    const descriptionQuality = item.description ? 80 : 0;
    totalScore += descriptionQuality;
    fieldCount++;
    if (!item.description) rationale.push('No description provided');

    // Value quality (important for auction)
    const valueQuality = item.estimatedValue && item.estimatedValue > 0 ? 90 : 20;
    totalScore += valueQuality;
    fieldCount++;
    if (!item.estimatedValue) rationale.push('Estimated value missing or invalid');

    // Category quality (helps with AI suggestions)
    const categoryQuality = item.categoryName ? 70 : 10;
    totalScore += categoryQuality;
    fieldCount++;
    if (!item.categoryName) rationale.push('No category provided');

    // Location quality (important for discovery)
    const locationQuality = item.region && item.city ? 80 : item.region ? 50 : 20;
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
    // Example: Mark as stale if no description (incomplete data)
    if (!item.description) return true;

    // Example: Mark as stale if value is unrealistic
    if (item.estimatedValue && item.estimatedValue <= 0) return true;

    return false;
  }

  // Optional: Validate config
  async validateConfig?(config: Record<string, unknown>): Promise<void> {
    if (!config.apiKey) {
      throw new Error('apiKey is required');
    }
  }

  // Optional: Health check
  async healthCheck?(): Promise<void> {
    // Try to reach external source
  }

  // Optional: Clean up
  async cleanup?(): Promise<void> {
    // Close connections, etc.
  }

  // Private helper (example)
  private async callExternalSource(
    query: string,
    options: FetchOptions
  ): Promise<Record<string, unknown>[]> {
    // Implement your fetch logic here
    return [];
  }
}
```

### 2. Register Adapter

File: `packages/api/src/autofetch/adapters/index.ts` (create if it doesn't exist)

```typescript
import { adapterRegistry } from './adapter.registry.js';
import { YourSourceAdapter } from './your-source.adapter.js';

// Register all built-in adapters
export function registerBuiltInAdapters() {
  adapterRegistry.register('your-source', new YourSourceAdapter());
  // ... other adapters
}

export { adapterRegistry };
```

Then in `packages/api/src/app.ts`, call:

```typescript
import { registerBuiltInAdapters } from './autofetch/adapters/index.js';

registerBuiltInAdapters();
```

### 3. Test Your Adapter

```typescript
import { describe, it, expect } from 'vitest';
import { YourSourceAdapter } from './your-source.adapter';

describe('YourSourceAdapter', () => {
  const adapter = new YourSourceAdapter();

  it('should fetch items', async () => {
    const items = await adapter.fetchItems('test', { timeout: 5000 });
    expect(items).toBeInstanceOf(Array);
    expect(items.length).toBeGreaterThan(0);
  });

  it('should normalize items', async () => {
    const raw = { id: '1', title: 'Test Item', value: 100 };
    const normalized = await adapter.normalize(raw);
    
    expect(normalized.title).toBe('Test Item');
    expect(normalized.externalId).toBe('1');
    expect(normalized.estimatedValue).toBe(100);
  });

  it('should score confidence', () => {
    const item = {
      title: 'A Very Long Descriptive Title',
      description: 'Full description here',
      estimatedValue: 500,
      categoryName: 'Electronics',
      region: 'Addis Ababa',
      quantity: 1,
      externalId: '1',
      externalSource: 'your-source',
      rawMetadata: {},
    };
    
    const score = adapter.scoreConfidence(item);
    expect(score.overall).toBeGreaterThan(70);
    expect(score.rationale).toBeInstanceOf(Array);
  });

  it('should detect stale items', async () => {
    const staleItem = { /* incomplete data */ };
    expect(adapter.isStale(staleItem)).toBe(true);
  });
});
```

## Built-in Adapters

### json-feed

Parses JSON API responses. Expects array of objects.

Config:
```json
{
  "url": "https://api.example.com/auctions",
  "apiKey": "optional-api-key",
  "itemsPath": "data.items",  // JSON path to items array
  "mappings": {
    "externalId": "id",
    "title": "name",
    "estimatedValue": "estimate"
  }
}
```

### csv-upload

Parses uploaded CSV files. Expects header row.

Config:
```json
{
  "headers": ["title", "description", "category", "value", "quantity"],
  "mappings": {
    "title": "title",
    "description": "description",
    "estimatedValue": "value"
  }
}
```

### web-scraper

Fetches one public HTML page and extracts Schema.org JSON-LD product-like
records (`Product`, `Vehicle`, and `RealEstateListing`). It also supports a
single Open Graph title/description/price record. When neither format yields a
record, the adapter can send up to 12,000 characters of visible page text to a
configured remote AI provider for candidate field suggestions. Every suggested
field must include a source quote found in that text. The suggestion records
the provider and evidence, receives a confidence score capped at 45%, and is
always pending for officer review. AI never publishes or changes an auction.

Before an AI-suggested item can be attached to a draft auction, an authorized
reviewer must submit the reviewed title and quantity and can correct or clear
the other published fields. The approval audit records the provider, changed
field names, and the final field snapshot.

Set `adapterConfig.aiExtraction` to `false` to disable remote AI extraction.
When enabled, the selected AI provider processes the public page text; disclose
that processing as required by your organization's privacy policy. A stub-only
AI configuration does not fabricate a result: pages without structured
metadata fail with an actionable provider/mapping error. The adapter does not
execute JavaScript.

Config:
```json
{
  "mappings": {
    "title": "name",
    "description": "description",
    "estimatedValue": "offers.price",
    "region": "address.addressRegion",
    "city": "address.addressLocality",
    "externalId": "sku"
  }
}
```

Mapping keys are normalized auction fields; values are dotted paths into a
Schema.org record. Built-in paths work when `mappings` is omitted, and a
custom path overrides only the field named. The adapter caps HTML at 2 MiB,
times out requests, follows at most three redirects, accepts only HTTP/HTTPS
on standard web ports, resolves and pins public IP addresses, and rejects
private/reserved destinations at every redirect. Pages that produce no
supported structured or evidence-backed title produce no queue item. For
example, create the source using:

```json
{
  "name": "Public asset notices",
  "adapterType": "web-scraper",
  "sourceUrl": "https://public.example.org/notices/asset-123",
  "adapterConfig": { "aiExtraction": true, "mappings": { "title": "name", "estimatedValue": "offers.price" } }
}
```

Only scrape sources that permit automated access. Respect their published
terms, robots directives, rate limits, and copyright restrictions; prefer an
official API or RSS feed when one exists. JavaScript-only pages still need a
source-specific adapter because the scraper does not run page scripts.

## Guidelines

1. **Always implement required methods** (`fetchItems`, `normalize`, `scoreConfidence`, `isStale`, `getMetadata`)
2. **Optional methods** can be added as needed (`validateConfig`, `healthCheck`, `cleanup`)
3. **Throw specific errors**:
   - `AdapterError` for fetch/network failures
   - `NormalizationError` for mapping failures
4. **Confidence scoring** should reflect data completeness and reliability (0–100)
5. **Normalize to internal types** consistently (camelCase, proper units, valid date formats)
6. **Handle missing fields gracefully** (use defaults, mark as optional)
7. **Add logging** for debugging and observability (see monitoring guidelines)

## Testing Checklist

- [ ] Adapter fetches from source without errors
- [ ] Fetched items normalize to valid NormalizedItem structure
- [ ] Confidence scores are consistent (same input → same score)
- [ ] Stale detection works (removes low-quality items)
- [ ] Error handling covers network failures and invalid data
- [ ] Edge cases handled (empty results, malformed data, timeouts)
