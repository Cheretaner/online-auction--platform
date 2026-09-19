export const ROLES = [
  "guest",
  "bidder",
  "auction_officer",
  "organization_admin",
  "compliance_officer",
  "super_admin",
] as const;
export type Role = (typeof ROLES)[number];

export const AUCTION_STATUS = [
  "draft",
  "pending_review",
  "scheduled",
  "live",
  "closed",
  "under_review",
  "awarded",
  "cancelled",
] as const;
export type AuctionStatus = (typeof AUCTION_STATUS)[number];

export const ERROR_CODES = [
  "AUCTION_NOT_LIVE",
  "AUCTION_CLOSED",
  "BID_BELOW_MINIMUM",
  "NOT_VERIFIED",
  "DEPOSIT_REQUIRED",
  "NOT_ELIGIBLE",
  "SELF_BIDDING",
  "SEALED_NOT_OPEN",
  "APPROVAL_SELF",
  "IDEMPOTENT_REPLAY",
  "AI_UNAVAILABLE",
  "CHAIN_BROKEN",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export const ORG_TYPES = [
  "government",
  "state_enterprise",
  "bank",
  "private",
] as const;
export type OrgType = (typeof ORG_TYPES)[number];

export const DOCUMENT_TYPES = [
  "specification",
  "inspection_report",
  "terms",
  "image",
  "other",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const AUCTION_TYPES = ['open_ascending', 'sealed_bid'] as const;
export type AuctionType = (typeof AUCTION_TYPES)[number];

export const ITEM_CONDITIONS = ['new', 'used_good', 'used_fair', 'salvage', 'unknown'] as const;
export type ItemCondition = (typeof ITEM_CONDITIONS)[number];

export const CATEGORY_SOURCES = ['ai_auto', 'ai_confirmed', 'manual'] as const;
export type CategorySource = (typeof CATEGORY_SOURCES)[number];

export const DEPOSIT_STATUS = ['pending', 'verified', 'rejected', 'released'] as const;
export type DepositStatus = (typeof DEPOSIT_STATUS)[number];

export const INSTRUMENT_TYPES = ['cpo', 'bank_guarantee', 'transfer'] as const;
export type InstrumentType = (typeof INSTRUMENT_TYPES)[number];

export const VERIFICATION_STATUS = ['unverified', 'pending', 'verified', 'rejected'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUS)[number];

export const VERIFICATION_DECISIONS = ['approved', 'rejected', 'resubmission_required'] as const;
export type VerificationDecision = (typeof VERIFICATION_DECISIONS)[number];

export const ACCOUNT_TYPES = ['individual', 'business'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];