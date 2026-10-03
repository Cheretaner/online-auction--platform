import type { QueryClient, QueryKey } from "@tanstack/react-query";

const STORAGE_KEY = "cheretanet-public-auction-cache-v1";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_BYTES = 1_500_000;
type Entry = { key: QueryKey; data: unknown; updatedAt: number };

function isPublicAuctionQuery(key: QueryKey): boolean {
  if (key[0] !== "auctions") return false;
  return (key[1] === "public" && key.length === 3)
    || (key[1] === "detail" && key.length === 3)
    || (typeof key[1] === "string" && key.length === 3 && key[2] === "items");
}

function readEntries(): Entry[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    const cutoff = Date.now() - MAX_AGE_MS;
    return parsed.filter((entry): entry is Entry =>
      typeof entry === "object" && entry !== null
      && Array.isArray(entry.key) && isPublicAuctionQuery(entry.key)
      && typeof entry.updatedAt === "number" && entry.updatedAt >= cutoff
      && "data" in entry,
    );
  } catch {
    return [];
  }
}

/** Persist only public auction listings, details, and lots; never authenticated history or mutations. */
export function restorePublicAuctionCache(client: QueryClient): void {
  if (typeof window === "undefined") return;
  for (const entry of readEntries()) {
    client.setQueryData(entry.key, entry.data, { updatedAt: entry.updatedAt });
  }
}

export function persistPublicAuctionCache(client: QueryClient): () => void {
  if (typeof window === "undefined") return () => undefined;
  let timer: number | undefined;
  return client.getQueryCache().subscribe(() => {
    if (timer !== undefined) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      const entries: Entry[] = client.getQueryCache().getAll()
        .filter((query) => isPublicAuctionQuery(query.queryKey) && query.state.data !== undefined)
        .map((query) => ({ key: query.queryKey, data: query.state.data, updatedAt: query.state.dataUpdatedAt }))
        .filter((entry) => entry.updatedAt >= Date.now() - MAX_AGE_MS);
      try {
        const serialized = JSON.stringify(entries);
        if (new Blob([serialized]).size <= MAX_BYTES) localStorage.setItem(STORAGE_KEY, serialized);
      } catch {
        // Storage can be disabled or full. Online use remains unaffected.
      }
    }, 300);
  });
}
