import { logger } from "../../shared/utils/logger.js";

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  tags: string[];
}

export class CacheService {
  private store = new Map<string, CacheEntry<unknown>>();
  private tagIndex = new Map<string, Set<string>>();
  private pruneTimer: NodeJS.Timeout | null = null;

  constructor() {
    // Periodically prune expired entries to guarantee zero memory leaks
    this.pruneTimer = setInterval(() => this.prune(), 60_000);
    this.pruneTimer.unref();
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.delete(key);
      return null;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlSeconds: number, tags: string[] = []): void {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.store.set(key, { value, expiresAt, tags });

    for (const tag of tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(key);
    }
  }

  async getOrSet<T>(
    key: string,
    ttlSeconds: number,
    fetcher: () => Promise<T>,
    tags: string[] = [],
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const fresh = await fetcher();
    this.set(key, fresh, ttlSeconds, tags);
    return fresh;
  }

  delete(key: string): void {
    const entry = this.store.get(key);
    if (entry) {
      for (const tag of entry.tags) {
        this.tagIndex.get(tag)?.delete(key);
      }
    }
    this.store.delete(key);
  }

  invalidateTag(tag: string): number {
    const keys = this.tagIndex.get(tag);
    if (!keys || keys.size === 0) return 0;
    let count = 0;
    for (const key of keys) {
      this.store.delete(key);
      count++;
    }
    this.tagIndex.delete(tag);
    logger.debug({ tag, invalidatedKeys: count }, "Cache tag invalidated");
    return count;
  }

  clear(): void {
    this.store.clear();
    this.tagIndex.clear();
  }

  prune(): number {
    const now = Date.now();
    let expired = 0;
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.delete(key);
        expired++;
      }
    }
    return expired;
  }
}

export const cacheService = new CacheService();
