// Canonical role vocabulary. These strings are the single source of truth and
// match the values stored in organization_members.role and profiles.platform_role.
// "organization_admin" is a legacy alias kept only for reading old rows; it is
// normalised to "org_admin" by kernel/roles.ts before it reaches the app.
export const ROLES = [
  "guest",
  "bidder",
  "auction_officer",
  "org_admin",
  "compliance_officer",
  "super_admin",
] as const;
export type Role = (typeof ROLES)[number];

/** Roles that may act on behalf of an organization. */
export const OFFICER_ROLES = [
  "auction_officer",
  "org_admin",
  "compliance_officer",
  "super_admin",
] as const;
export type OfficerRole = (typeof OFFICER_ROLES)[number];

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
  "AUCTION_NOT_CLOSED",
  "BID_BELOW_MINIMUM",
  "BID_NOT_FOUND",
  "NOT_VERIFIED",
  "DEPOSIT_REQUIRED",
  "DEPOSIT_REFUND_REQUIRED",
  "NOT_ELIGIBLE",
  "SELF_BIDDING",
  "SEALED_NOT_OPEN",
  "APPROVAL_SELF",
  "IDEMPOTENT_REPLAY",
  "IDEMPOTENCY_KEY_REQUIRED",
  "AI_UNAVAILABLE",
  "CHAIN_BROKEN",
  "DISPUTE_INVALID_TRANSITION",
  "NOTIFICATION_NOT_FOUND",
  "REPORT_NOT_FOUND",
  "AUCTION_NOT_FOUND",
  "VALIDATION_FAILED",
  "ORG_CONTEXT_REQUIRED",
  "FORBIDDEN",
  "REFRESH_TOKEN_INVALID",
  "REFRESH_TOKEN_REUSED",
  "RESET_TOKEN_INVALID",
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
  "identity_document",
  "deposit_release_evidence",
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
export const DEPOSIT_INSTRUMENT_TYPES = [...INSTRUMENT_TYPES, "chapa"] as const;
export type InstrumentType = (typeof DEPOSIT_INSTRUMENT_TYPES)[number];

// Snapshot of the National Bank of Ethiopia's published bank directory.
export const ETHIOPIAN_BANKS = [
  "Abay Bank S.C.",
  "Addis Bank S.C",
  "Ahadu Bank S.C.",
  "Amhara Bank S.C.",
  "Anbesa Bank",
  "Awash Bank S.C.",
  "Bank of Abyssinia",
  "Berhan Bank S.C.",
  "Bunna Bank S.C",
  "Commercial Bank of Ethiopia",
  "Cooperative Bank of Oromia",
  "Dashen Bank S.C.",
  "Development Bank of Ethiopia",
  "Enat Bank S.C.",
  "Gadaa Bank S.C.",
  "Global Bank S.C",
  "Goh Betoch Bank S.C.",
  "Hibret Bank S.C.",
  "Hijra Bank S.C.",
  "Nib Int. Bank S.C.",
  "Omo Bank S.C.",
  "Oromia Bank S.C.",
  "Rammis Bank S.C.",
  "Shabelle Bank S.C.",
  "Sidama Bank S.C.",
  "Siinqee Bank S.C.",
  "Siket Bank S.C",
  "Tsedey Bank S.C.",
  "Tsehay Bank S.C.",
  "Wegagen Bank S.C.",
  "ZamZam Bank S.C.",
  "Zemen Bank S.C.",
] as const;
export type EthiopianBank = (typeof ETHIOPIAN_BANKS)[number];

export const VERIFICATION_STATUS = ['unverified', 'pending', 'verified', 'rejected'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUS)[number];

export const VERIFICATION_DOCUMENT_TYPES = ["national_id", "kebele_id", "passport"] as const;
export type VerificationDocumentType = (typeof VERIFICATION_DOCUMENT_TYPES)[number];

export const VERIFICATION_DECISIONS = ['approved', 'rejected', 'resubmission_required'] as const;
export type VerificationDecision = (typeof VERIFICATION_DECISIONS)[number];

export const ACCOUNT_TYPES = ['individual', 'business'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ANOMALY_SEVERITY = ['low', 'medium', 'high'] as const;
export type AnomalySeverity = (typeof ANOMALY_SEVERITY)[number];

export const ANOMALY_STATUS = ['open', 'reviewed', 'dismissed', 'escalated'] as const;
export type AnomalyStatus = (typeof ANOMALY_STATUS)[number];

export const DISPUTE_STATUS = ['open', 'under_review', 'resolved', 'rejected'] as const;
export type DisputeStatus = (typeof DISPUTE_STATUS)[number];

export const NOTIFICATION_CHANNEL = ['in_app', 'email', 'telegram'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNEL)[number];

export const NOTIFICATION_STATUS = ['pending', 'sent', 'failed', 'read'] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUS)[number];

export const COMPLIANCE_CHECK_STATUS = ['pending', 'passed', 'failed'] as const;
export type ComplianceCheckStatus = (typeof COMPLIANCE_CHECK_STATUS)[number];

export const REPORT_TYPE = ['auction_summary', 'compliance', 'audit_trail'] as const;
export type ReportType = (typeof REPORT_TYPE)[number];
