const store = new Map<string, { expiresAt: number; payload: unknown }>();

const TTL_MS = 24 * 60 * 60 * 1000;

export function getIdempotentReplay<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return entry.payload as T;
}

export function setIdempotentReplay(key: string, payload: unknown): void {
  store.set(key, { expiresAt: Date.now() + TTL_MS, payload });
}
