import { aiProviderAdapter } from "../infrastructure/ai/provider.adapter.js";
import * as biddingRepo from "../bidding/bidding.repository.js";

export async function askAssistant(
  prompt: string,
  auctionId?: string,
): Promise<{ answer: string; provider: string; fallback: boolean }> {
  let context = prompt;
  if (auctionId) {
    const auction = await biddingRepo.findAuction(auctionId);
    if (auction) {
      context = `Auction "${auction.title}" status=${auction.status} type=${auction.auctionType} bids=${auction.bidCount} highest=${auction.currentHighestBid}\n\n${prompt}`;
    }
  }
  return aiProviderAdapter.assist(context);
}
