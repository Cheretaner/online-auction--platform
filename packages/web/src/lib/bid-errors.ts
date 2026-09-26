import { getErrorMessage, isApiError } from "@/lib/api/errors";

export interface BidErrorExplanation {
  message: string;
  /** Where the bidder can fix the problem, when there is such a place. */
  action?: { label: string; to: string };
}

/** Turns the API's bid rejection codes into guidance a bidder can act on. */
export function explainBidError(error: unknown): BidErrorExplanation {
  if (!isApiError(error)) return { message: getErrorMessage(error) };
  switch (error.code) {
    case "NOT_VERIFIED":
      return {
        message: "Your identity has not been verified yet. Bids are accepted only from verified bidders.",
        action: { label: "Go to identity verification", to: "/app/kyc" },
      };
    case "DEPOSIT_REQUIRED":
      return { message: "This auction needs a verified bid security deposit before you can bid. Submit it below." };
    case "BID_BELOW_MINIMUM":
      return { message: "Someone bid first or your amount is below the minimum. Refresh the price and bid again." };
    case "AUCTION_CLOSED":
      return { message: "This auction has closed. Bids are no longer accepted." };
    case "AUCTION_NOT_LIVE":
      return { message: "This auction is not open for bidding right now." };
    case "SELF_BIDDING":
      return { message: "Staff of the organization running this auction cannot bid on it." };
    case "IDEMPOTENT_REPLAY":
      return { message: "This bid was already recorded. Your earlier submission went through." };
    default:
      return { message: error.message };
  }
}
