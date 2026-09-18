import { addMoney, compareMoney, formatMoney, parseMoney } from "../kernel/money.js";
import type { AuctionLockSnapshot } from "./bidding.types.js";

export function minimumAcceptableBid(auction: AuctionLockSnapshot): string {
  if (auction.auctionType === "sealed_bid" || auction.bidCount === 0 || compareMoney(auction.currentHighestBid, "0.00") <= 0) {
    return auction.startPrice;
  }
  return addMoney(auction.currentHighestBid, auction.minIncrement);
}

export function computeAntiSnipe(input: {
  now: Date;
  closesAt: Date;
  antiSnipeSeconds: number;
  extensionCount: number;
  maxExtensions: number;
}): { extended: boolean; closesAt: Date; extensionCount: number } {
  if (input.antiSnipeSeconds <= 0 || input.extensionCount >= input.maxExtensions) {
    return { extended: false, closesAt: input.closesAt, extensionCount: input.extensionCount };
  }

  const remainingMs = input.closesAt.getTime() - input.now.getTime();
  if (remainingMs > input.antiSnipeSeconds * 1000) {
    return { extended: false, closesAt: input.closesAt, extensionCount: input.extensionCount };
  }

  const extendedClose = new Date(input.now.getTime() + input.antiSnipeSeconds * 1000);
  const closesAt = extendedClose > input.closesAt ? extendedClose : input.closesAt;
  return {
    extended: closesAt.getTime() !== input.closesAt.getTime(),
    closesAt,
    extensionCount: input.extensionCount + (closesAt.getTime() !== input.closesAt.getTime() ? 1 : 0),
  };
}

export function isRoundNumber(amount: string): boolean {
  return parseMoney(amount) % 10000n === 0n;
}

export function jumpRatio(previous: string, next: string): number {
  const prev = Number(previous);
  if (!Number.isFinite(prev) || prev <= 0) return 0;
  return Number(next) / prev;
}

export function formatBidAmount(amount: string): string {
  return formatMoney(parseMoney(amount));
}
