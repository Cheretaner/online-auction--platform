import type { BidSummary } from "@auction/shared";
import type { AuctionLockSnapshot, BidRecord } from "./bidding.types.js";

export function toPublicBid(
  bid: BidRecord,
  auction: AuctionLockSnapshot,
  viewer: { viewerId: string; isOfficer: boolean },
): BidSummary {
  const sealedClosed = auction.auctionType === "sealed_bid" && !auction.sealedOpenedAt;
  const own = bid.bidderId === viewer.viewerId;
  const revealAmount = !sealedClosed || own;

  return {
    id: bid.id,
    auctionId: bid.auctionId,
    bidderId: sealedClosed && !own && !viewer.isOfficer ? "redacted" : bid.bidderId,
    amount: revealAmount && (!sealedClosed || own || (viewer.isOfficer && Boolean(auction.sealedOpenedAt)))
      ? bid.amount
      : sealedClosed
        ? null
        : bid.amount,
    status: bid.status,
    isSealed: bid.isSealed,
    placedAt: bid.placedAt,
    redacted: !revealAmount || (sealedClosed && !own),
  };
}
