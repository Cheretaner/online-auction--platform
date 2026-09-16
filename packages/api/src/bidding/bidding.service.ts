import type { PlaceBidRequest } from "@auction/shared";
import { getIdempotentReplay, setIdempotentReplay } from "../shared/utils/idempotency.js";
import * as auctionService from "../auction/auction.service.js";
import * as repo from "./bidding.repository.js";
import { validateBidPlacement } from "./bidding.rules.js";
import type { Bid } from "./bidding.types.js";

export async function placeBid(
  auctionId: string,
  bidderId: string,
  input: PlaceBidRequest,
  idempotencyKey?: string,
): Promise<Bid> {
  if (idempotencyKey) {
    const replay = getIdempotentReplay<Bid>(`${auctionId}:${idempotencyKey}`);
    if (replay) return replay;
  }

  const auction = await auctionService.getAuction(auctionId);
  validateBidPlacement(auction, bidderId, input.amount);

  const bid = await repo.insertBid({
    auctionId,
    bidderId,
    amount: input.amount,
    idempotencyKey,
  });

  if (idempotencyKey) {
    setIdempotentReplay(`${auctionId}:${idempotencyKey}`, bid);
  }

  return bid;
}
