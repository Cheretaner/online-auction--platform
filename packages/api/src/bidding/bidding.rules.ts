import { addMoney, compareMoney, parseMoney } from "../kernel/money.js";
import { BiddingError } from "./bidding.errors.js";
import type { AuctionLockSnapshot } from "./bidding.types.js";

export interface AntiSnipeInput {
  now: Date;
  closesAt: Date;
  antiSnipeSeconds: number;
  extensionCount: number;
  maxExtensions: number;
}

export interface AntiSnipeResult {
  extended: boolean;
  closesAt: Date;
  extensionCount: number;
}

/**
 * Smallest bid the auction will accept right now.
 *
 * Open ascending: the first bid must reach the start price; every later bid
 * must clear the standing high by at least `min_increment`.
 *
 * Sealed bid: bids are private, so there is no standing high to beat — the
 * floor is simply the start price. Using `current_highest_bid` here would
 * leak the leading amount through rejection messages.
 */
export function minimumAcceptableBid(auction: AuctionLockSnapshot): string {
  if (auction.auctionType === "sealed_bid") {
    return auction.startPrice;
  }

  const highest = auction.currentHighestBid ?? "0.00";
  if (parseMoney(highest) <= 0n) {
    return auction.startPrice;
  }
  return addMoney(highest, auction.minIncrement);
}

/**
 * Anti-sniping: a bid landing inside the closing window pushes `closes_at`
 * out so other bidders get a fair chance to respond. Capped by
 * `max_extensions` so an auction cannot be held open indefinitely.
 *
 * The new close is computed from `now`, not from the existing `closes_at`,
 * so each extension grants exactly one full window rather than compounding.
 */
export function computeAntiSnipe(input: AntiSnipeInput): AntiSnipeResult {
  const windowMs = Math.max(0, input.antiSnipeSeconds) * 1000;
  const remainingMs = input.closesAt.getTime() - input.now.getTime();

  const eligible =
    windowMs > 0 &&
    remainingMs > 0 &&
    remainingMs <= windowMs &&
    input.extensionCount < input.maxExtensions;

  if (!eligible) {
    return {
      extended: false,
      closesAt: input.closesAt,
      extensionCount: input.extensionCount,
    };
  }

  const nextClose = new Date(input.now.getTime() + windowMs);

  // closes_at is constrained to never move backwards (see
  // auctions_closing_not_before_original), so guard against a shorter window
  // than the time already remaining.
  if (nextClose.getTime() <= input.closesAt.getTime()) {
    return {
      extended: false,
      closesAt: input.closesAt,
      extensionCount: input.extensionCount,
    };
  }

  return {
    extended: true,
    closesAt: nextClose,
    extensionCount: input.extensionCount + 1,
  };
}

/**
 * Ratio between two consecutive bid amounts, used by the anomaly rules to
 * spot implausible price jumps. Returns 0 when the earlier amount is zero
 * so a first bid never registers as an infinite jump.
 */
export function jumpRatio(previousAmount: string, nextAmount: string): number {
  const previous = Number(previousAmount);
  const next = Number(nextAmount);
  if (!Number.isFinite(previous) || !Number.isFinite(next) || previous <= 0) {
    return 0;
  }
  return next / previous;
}

/**
 * True when an amount is a suspiciously round figure (a whole multiple of
 * 1,000 with no cents). On its own this means nothing; it only contributes
 * a small weight to the anomaly score alongside other signals.
 */
export function isRoundNumber(amount: string): boolean {
  const cents = parseMoney(amount);
  if (cents <= 0n) return false;
  return cents % 100_000n === 0n;
}

/**
 * Lightweight guard used outside the locked bid-placement path (the
 * authoritative checks live in placement.policy.ts, which also verifies
 * KYC, deposits and auction timing under a row lock).
 */
export function validateBidPlacement(
  auction: AuctionLockSnapshot,
  bidderId: string,
  amount: string,
): void {
  if (auction.status !== "live") {
    throw new BiddingError("Auction is not live", "AUCTION_NOT_LIVE");
  }
  if (auction.createdBy === bidderId) {
    throw new BiddingError("Self bidding is not allowed", "SELF_BIDDING");
  }
  if (compareMoney(amount, minimumAcceptableBid(auction)) < 0) {
    throw new BiddingError("Bid below minimum", "BID_BELOW_MINIMUM");
  }
}
