/**
 * Adapter Framework Exports
 * Interface, registry, and concrete adapter implementations
 */

import { adapterRegistry } from './adapter.registry.js';
import { JsonFeedAdapter } from './json-feed.adapter.js';
import { CsvUploadAdapter } from './csv-upload.adapter.js';

// Interfaces are erased by TypeScript. This must remain a type-only re-export
// or Node's ESM loader will look for a runtime JavaScript export that does
// not exist in adapter.interface.js.
export type { ISourceAdapter } from './adapter.interface.js';
export { AdapterRegistry, adapterRegistry } from './adapter.registry.js';

// Concrete adapters
export { JsonFeedAdapter } from './json-feed.adapter.js';
export { CsvUploadAdapter } from './csv-upload.adapter.js';

/**
 * Register all built-in adapters at app startup
 * Called from app.ts before any autofetch operations
 */
export function registerBuiltInAdapters() {
  adapterRegistry.register('json-feed', new JsonFeedAdapter());
  adapterRegistry.register('csv-upload', new CsvUploadAdapter());
}
