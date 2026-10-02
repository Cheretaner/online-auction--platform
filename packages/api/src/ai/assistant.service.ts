import { aiProviderAdapter } from "../infrastructure/ai/provider.adapter.js";
import { PLATFORM_GUIDE } from "./assistant.knowledge.js";
import * as auctionRepo from "../auction/auction.repository.js";
import * as auctionItemRepo from "../auction/auction-item.repository.js";
import { env } from "../config/env.js";

export async function askAssistant(
  prompt: string,
  auctionId?: string,
): Promise<{ answer: string; provider: string; fallback: boolean }> {
  const webBaseUrl = env.WEB_BASE_URL.replace(/\/$/, "");
  const websiteLinks = [
    `Public auction listings: ${webBaseUrl}/auctions`,
    `Auction notice template: ${webBaseUrl}/auctions/{auctionId}`,
    `Public reports: ${webBaseUrl}/reports/{reportId}`,
    `Sign in: ${webBaseUrl}/login`,
    `Create account: ${webBaseUrl}/register`,
    `Bidder identity verification (signed in): ${webBaseUrl}/app/kyc`,
    `Bid security and deposits (signed in): ${webBaseUrl}/app/deposits`,
    `My documents (signed in): ${webBaseUrl}/app/documents`,
    `Bidder dashboard (signed in): ${webBaseUrl}/app`,
    `Organization auction workspace (authorized staff): ${webBaseUrl}/app/auctions`,
    `Organization auction creation (authorized staff): ${webBaseUrl}/app/auctions/new`,
    `AI assistant (signed in): ${webBaseUrl}/app/ai-assistant`,
    `Telegram settings (signed in): ${webBaseUrl}/app/telegram`,
    `Profile and account settings (signed in): ${webBaseUrl}/app/profile`,
    `Disputes (signed in): ${webBaseUrl}/app/disputes`,
    `Notifications (signed in): ${webBaseUrl}/app/notifications`,
    `KYC review (authorized reviewers): ${webBaseUrl}/app/kyc/review`,
    `Reports workspace (authorized staff): ${webBaseUrl}/app/reports`,
    `Audit workspace (authorized staff): ${webBaseUrl}/app/audit`,
  ].join("\n");
  const contextParts = [
    `Verified Cheretanet website guide:\n${PLATFORM_GUIDE}`,
    `Website base URL: ${webBaseUrl}`,
    `Verified website links (use Markdown links with these exact URLs; signed-in and staff pages require the stated access):\n${websiteLinks}`,
    `User question:\n${prompt}`,
  ];
  if (auctionId) {
    const auction = await auctionRepo.findById(auctionId);
    if (auction) {
      const items = await auctionItemRepo.getAuctionItems(auctionId, 12);
      contextParts.splice(1, 0, [
        "Live auction context (authoritative for this auction):",
        `Title: ${auction.title}`,
        `Auction page: ${webBaseUrl}/auctions/${auction.id}`,
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
