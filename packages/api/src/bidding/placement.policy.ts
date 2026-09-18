import { BiddingError } from "./bidding.errors.js";
import { compareMoney } from "../kernel/money.js";
import { minimumAcceptableBid } from "./bidding.rules.js";
import type { AuctionLockSnapshot, BidderSnapshot } from "./bidding.types.js";

export interface BidPlacementContext {
  auction: AuctionLockSnapshot;
  bidder: BidderSnapshot;
  amount: string;
  now: Date;
  commitmentHash?: string;
  isOrgOfficer: boolean;
  depositVerified: boolean;
}

export function assertBidPlacement(ctx: BidPlacementContext): void {
  if (ctx.auction.status !== "live") {
    throw new BiddingError("Auction is not live", "AUCTION_NOT_LIVE");
  }
  if (ctx.now < ctx.auction.opensAt) {
    throw new BiddingError("Auction is not live", "AUCTION_NOT_LIVE");
  }
  if (ctx.now >= ctx.auction.closesAt) {
    throw new BiddingError("Auction is closed", "AUCTION_CLOSED");
  }
  if (ctx.auction.createdBy === ctx.bidder.id || ctx.isOrgOfficer) {
    throw new BiddingError("Self bidding is not allowed", "SELF_BIDDING");
  }
  if (ctx.bidder.verificationStatus !== "verified") {
    throw new BiddingError("Bidder is not verified", "NOT_VERIFIED");
  }
  if (compareMoney(ctx.auction.depositAmount, "0.00") > 0 && !ctx.depositVerified) {
    throw new BiddingError("Verified deposit is required", "DEPOSIT_REQUIRED");
  }
  if (ctx.auction.auctionType === "sealed_bid" && !ctx.commitmentHash) {
    throw new BiddingError("Sealed bids require a commitment hash", "NOT_ELIGIBLE");
  }
  if (ctx.auction.auctionType === "open_ascending" && ctx.commitmentHash) {
    throw new BiddingError("Open auctions do not accept sealed commitments", "NOT_ELIGIBLE");
  }

  const minimum = minimumAcceptableBid(ctx.auction);
  if (compareMoney(ctx.amount, minimum) < 0) {
    throw new BiddingError("Bid below minimum", "BID_BELOW_MINIMUM");
  }
}
