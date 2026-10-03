import type { BidRecord, ItemList } from "@/lib/api/types";

const STORAGE_KEY = "cheretanet-private-bid-history-v1";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_AUCTIONS = 30;
const MAX_BIDS_PER_AUCTION = 50;
const MAX_BYTES = 180_000;

interface Entry {
  userId: string;
  auctionId: string;
  savedAt: number;
  items: BidRecord[];
}

function readEntries(): Entry[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    const cutoff = Date.now() - MAX_AGE_MS;
    return parsed.filter((entry): entry is Entry =>
      typeof entry === "object" && entry !== null
      && typeof entry.userId === "string" && typeof entry.auctionId === "string"
      && typeof entry.savedAt === "number" && entry.savedAt >= cutoff
      && Array.isArray(entry.items) && entry.items.every(isBidRecord),
    );
  } catch {
    return [];
  }
}

function isBidRecord(value: unknown): value is BidRecord {
  if (!value || typeof value !== "object") return false;
  const bid = value as Partial<BidRecord>;
  return typeof bid.id === "string"
    && typeof bid.auctionId === "string"
    && typeof bid.bidderId === "string"
    && (bid.amount === null || typeof bid.amount === "string")
    && (bid.status === "active" || bid.status === "withdrawn" || bid.status === "superseded")
    && typeof bid.isSealed === "boolean"
    && typeof bid.placedAt === "string"
    && typeof bid.redacted === "boolean";
}

/** Only this bidder's bid receipts are stored, for this browser tab and account. */
export function readPrivateBidHistory(userId: string, auctionId: string): { data: ItemList<BidRecord>; savedAt: number } | undefined {
  const entry = readEntries().find((candidate) => candidate.userId === userId && candidate.auctionId === auctionId);
  if (!entry) return undefined;
  const ownItems = entry.items.filter((bid) => bid.auctionId === auctionId && bid.bidderId === userId && !bid.redacted);
  return { data: { items: ownItems }, savedAt: entry.savedAt };
}

export function savePrivateBidHistory(userId: string, auctionId: string, items: BidRecord[]): void {
  if (typeof window === "undefined") return;
  const ownItems = items
    .filter((bid) => bid.bidderId === userId && !bid.redacted)
    .slice(0, MAX_BIDS_PER_AUCTION)
    .map((bid) => ({
      id: bid.id,
      auctionId: bid.auctionId,
      bidderId: bid.bidderId,
      amount: bid.amount,
      status: bid.status,
      isSealed: bid.isSealed,
      placedAt: bid.placedAt,
      redacted: false,
    }));
  const entries = readEntries().filter((entry) => !(entry.userId === userId && entry.auctionId === auctionId));
  entries.unshift({ userId, auctionId, savedAt: Date.now(), items: ownItems });
  try {
    const serialized = JSON.stringify(entries.slice(0, MAX_AUCTIONS));
    if (new Blob([serialized]).size <= MAX_BYTES) window.sessionStorage.setItem(STORAGE_KEY, serialized);
  } catch {
    // Private offline convenience is optional; storage failures never affect the online request.
  }
}

export function clearPrivateBidHistory(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(STORAGE_KEY);
}
