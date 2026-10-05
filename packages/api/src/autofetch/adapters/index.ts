/**
 * Adapter Framework Exports
 * Interface, registry, and concrete adapter implementations
 */

import { adapterRegistry } from './adapter.registry.js';
import { JsonFeedAdapter } from './json-feed.adapter.js';
import { CsvUploadAdapter } from './csv-upload.adapter.js';
import { RssFeedAdapter } from './rss-feed.adapter.js';
import { WebScraperAdapter } from './web-scraper.adapter.js';
import { AiRssAdapter } from './ai-rss.adapter.js';

// Interfaces are erased by TypeScript. This must remain a type-only re-export
// or Node's ESM loader will look for a runtime JavaScript export that does
// not exist in adapter.interface.js.
export type { ISourceAdapter } from './adapter.interface.js';
export { AdapterRegistry, adapterRegistry } from './adapter.registry.js';

// Concrete adapters
export { JsonFeedAdapter } from './json-feed.adapter.js';
export { CsvUploadAdapter } from './csv-upload.adapter.js';
export { RssFeedAdapter } from './rss-feed.adapter.js';
export { WebScraperAdapter } from './web-scraper.adapter.js';
export { AiRssAdapter } from './ai-rss.adapter.js';

/**
 * Register all built-in adapters at app startup
 * Called from app.ts before any autofetch operations
 */
export function registerBuiltInAdapters() {
  const adapters = [
    ['json-feed', new JsonFeedAdapter()],
    ['csv-upload', new CsvUploadAdapter()],
    ['rss-feed', new RssFeedAdapter()],
    ['web-scraper', new WebScraperAdapter()],
    ['telegram-rss', new AiRssAdapter()],
  ] as const;

  for (const [name, adapter] of adapters) {
    if (!adapterRegistry.has(name)) adapterRegistry.register(name, adapter);
  }
}
