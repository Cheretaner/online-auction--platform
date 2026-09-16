import type { Auction } from "../auction/auction.types.js";
import { BiddingError } from "./bidding.errors.js";

export function validateBidPlacement(auction: Auction, bidderId: string, amount: string): void {
  if (auction.status !== "live") {
    throw new BiddingError("Auction is not live", "AUCTION_NOT_LIVE");
  }

  if (auction.createdBy === bidderId) {
    throw new BiddingError("Self bidding is not allowed", "SELF_BIDDING");
  }

  const minimum = auction.currentHighestBid ?? auction.startingPrice;
  if (Number(amount) <= Number(minimum)) {
    throw new BiddingError("Bid below minimum", "BID_BELOW_MINIMUM");
  }
}
