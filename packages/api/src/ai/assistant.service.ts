import { aiProviderAdapter } from "../infrastructure/ai/provider.adapter.js";
import { PLATFORM_GUIDE } from "./assistant.knowledge.js";
import * as auctionRepo from "../auction/auction.repository.js";
import * as auctionItemRepo from "../auction/auction-item.repository.js";

export async function askAssistant(
  prompt: string,
  auctionId?: string,
): Promise<{ answer: string; provider: string; fallback: boolean }> {
  const contextParts = [`Verified CheretaNet website guide:\n${PLATFORM_GUIDE}`, `User question:\n${prompt}`];
  if (auctionId) {
    const auction = await auctionRepo.findById(auctionId);
    if (auction) {
      const items = await auctionItemRepo.getAuctionItems(auctionId, 12);
      contextParts.splice(1, 0, [
        "Live auction context (authoritative for this auction):",
        `Title: ${auction.title}`,
        `Status: ${auction.status}`,
        `Format: ${auction.auctionType}`,
        `Description: ${auction.description ?? "not supplied"}`,
        `Region: ${auction.region ?? "not supplied"}`,
        `Opening time: ${auction.opensAt.toISOString()}`,
        `Closing time: ${auction.closesAt.toISOString()}`,
        `Starting price: ETB ${auction.startPrice}`,
        `Minimum increment: ETB ${auction.minIncrement}`,
        `Required bid security: ETB ${auction.depositAmount}`,
        `Bid count: ${auction.bidCount}`,
        ...(auction.auctionType === "open_ascending" && auction.status === "live"
          ? [`Current highest bid: ETB ${auction.currentHighestBid ?? auction.startPrice}`]
          : []),
        `Eligibility rules: ${auction.eligibilityRules ?? "not supplied"}`,
        `Lots (up to 12): ${items.length === 0 ? "none listed" : items.map((item) => [
          item.title,
          item.description,
          item.condition ? `condition: ${item.condition}` : "",
          item.aiCategorySuggestion ? `category suggestion: ${item.aiCategorySuggestion}` : "",
          `quantity: ${item.quantity}${item.unit ? ` ${item.unit}` : ""}`,
        ].filter(Boolean).join("; ")).join("\n- ")}`,
        auction.auctionType === "sealed_bid" && !auction.sealedOpenedAt
          ? "Sealed offers have not been formally opened; do not infer or disclose offer values or a winner."
          : "",
      ].filter(Boolean).join("\n"));
    }
  }
  return aiProviderAdapter.assist(contextParts.join("\n\n"));
}
