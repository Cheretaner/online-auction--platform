import { env } from "../../config/env.js";

type IdempotencyEntry = {
  expiresAt: number;
  statusCode: number;
  payload: unknown;
};

const store = new Map<string, IdempotencyEntry>();

export function buildIdempotencyKey(parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join(":");
}

export function getIdempotentReplay<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return entry.payload as T;
}

export function getIdempotentResponse(key: string): { statusCode: number; payload: unknown } | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return { statusCode: entry.statusCode, payload: entry.payload };
}

export function setIdempotentReplay(key: string, payload: unknown, statusCode = 200): void {
  store.set(key, {
    expiresAt: Date.now() + env.IDEMPOTENCY_TTL_MS,
    statusCode,
    payload,
  });
}

export function pruneExpiredIdempotencyKeys(now = Date.now()): number {
  let removed = 0;
  for (const [key, entry] of store) {
    if (now > entry.expiresAt) {
      store.delete(key);
      removed += 1;
    }
  }
  return removed;
}

export function clearIdempotencyStore(): void {
  store.clear();
}
