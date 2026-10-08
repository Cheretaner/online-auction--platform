import { getErrorMessage, isApiError } from "@/lib/api/errors";
import { translate } from "@/i18n/context";

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
        message: translate("auctions", "bid.errors.notVerified"),
        action: { label: translate("auctions", "bid.errors.goVerify"), to: "/app/kyc" },
      };
    case "DEPOSIT_REQUIRED":
      return { message: translate("auctions", "bid.errors.depositRequired") };
    case "DOCUMENT_ACCESS_REQUIRED":
      return { message: translate("auctions", "documents.accessRequired") };
    case "BID_BELOW_MINIMUM":
      return { message: translate("auctions", "bid.errors.belowMinimum") };
    case "AUCTION_CLOSED":
      return { message: translate("auctions", "bid.errors.closed") };
    case "AUCTION_NOT_LIVE":
      return { message: translate("auctions", "bid.errors.notLive") };
    case "SELF_BIDDING":
      return { message: translate("auctions", "bid.errors.selfBidding") };
    case "IDEMPOTENT_REPLAY":
      return { message: translate("auctions", "bid.errors.replay") };
    default:
      return { message: error.message };
  }
}
