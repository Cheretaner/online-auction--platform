export const ROLES = [
  "guest", "bidder", "auction_officer",
  "org_admin", "compliance_officer", "super_admin",
] as const;
export type Role = (typeof ROLES)[number];

export const AUCTION_STATUS = [
  "draft", "pending_review", "scheduled", "live",
  "closed", "under_review", "awarded", "cancelled",
] as const;
export type AuctionStatus = (typeof AUCTION_STATUS)[number];

export const ERROR_CODES = [
  "AUCTION_NOT_LIVE", "AUCTION_CLOSED", "BID_BELOW_MINIMUM",
  "NOT_VERIFIED", "DEPOSIT_REQUIRED", "NOT_ELIGIBLE",
  "SELF_BIDDING", "SEALED_NOT_OPEN", "APPROVAL_SELF",
  "IDEMPOTENT_REPLAY", "AI_UNAVAILABLE", "CHAIN_BROKEN",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];