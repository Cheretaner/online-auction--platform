/**
 * Adapter Framework Exports
 * Interface, registry, and concrete adapter implementations
 */

export { ISourceAdapter } from './adapter.interface.js';
export { AdapterRegistry, adapterRegistry } from './adapter.registry.js';

// Concrete adapters will be imported and registered here
// See json-feed.adapter.ts and csv-upload.adapter.ts

/**
 * Register all built-in adapters at app startup
 * Called from app.ts before any autofetch operations
 */
export function registerBuiltInAdapters() {
  // Adapters will be registered here after they're created
  // import { JsonFeedAdapter } from './json-feed.adapter.js';
  // import { CsvUploadAdapter } from './csv-upload.adapter.js';
  // adapterRegistry.register('json-feed', new JsonFeedAdapter());
  // adapterRegistry.register('csv-upload', new CsvUploadAdapter());
}
