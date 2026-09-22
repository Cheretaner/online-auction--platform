/**
 * Adapter Registry
 * Runtime discovery and management of source adapters
 * Enables pluggable architecture: register adapters, retrieve by name, list all
 */

import { ISourceAdapter } from './adapter.interface.js';

export class AdapterRegistry {
  private adapters: Map<string, ISourceAdapter> = new Map();

  /**
   * Register a new adapter with a unique name
   *
   * @param name Unique adapter identifier (e.g., 'json-feed', 'web-scraper')
   * @param adapter Adapter implementation
   * @throws Error if name already registered
   */
  register(name: string, adapter: ISourceAdapter): void {
    if (this.adapters.has(name)) {
      throw new Error(`Adapter '${name}' is already registered`);
    }
    this.adapters.set(name, adapter);
  }

  /**
   * Get adapter by name
   *
   * @param name Adapter identifier
   * @throws Error if adapter not found
   */
  get(name: string): ISourceAdapter {
    const adapter = this.adapters.get(name);
    if (!adapter) {
      throw new Error(`Adapter '${name}' not found. Available: ${this.list().join(', ')}`);
    }
    return adapter;
  }

  /**
   * Check if adapter exists
   */
  has(name: string): boolean {
    return this.adapters.has(name);
  }

  /**
   * Get all registered adapter names
   */
  list(): string[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Get all registered adapters with metadata
   */
  listWithMetadata(): Array<{ name: string; metadata: ReturnType<ISourceAdapter['getMetadata']> }> {
    return Array.from(this.adapters.entries()).map(([name, adapter]) => ({
      name,
      metadata: adapter.getMetadata(),
    }));
  }

  /**
   * Unregister an adapter (useful for testing or teardown)
   */
  unregister(name: string): void {
    this.adapters.delete(name);
  }

  /**
   * Clear all adapters (useful for testing)
   */
  clear(): void {
    this.adapters.clear();
  }

  /**
   * Get size (number of registered adapters)
   */
  size(): number {
    return this.adapters.size;
  }
}

// Singleton instance
export const adapterRegistry = new AdapterRegistry();
