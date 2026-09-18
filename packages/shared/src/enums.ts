export const ROLES = [
  "guest",
  "bidder",
  "auction_officer",
  "org_admin",
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

export const AUCTION_TYPE = ["open_ascending", "sealed_bid"] as const;
export type AuctionType = (typeof AUCTION_TYPE)[number];

export const BID_STATUS = ["active", "withdrawn", "superseded"] as const;
export type BidStatus = (typeof BID_STATUS)[number];

export const DISPUTE_STATUS = ["open", "under_review", "resolved", "rejected"] as const;
export type DisputeStatus = (typeof DISPUTE_STATUS)[number];

export const ANOMALY_SEVERITY = ["low", "medium", "high"] as const;
export type AnomalySeverity = (typeof ANOMALY_SEVERITY)[number];

export const ANOMALY_STATUS = ["open", "reviewed", "dismissed", "escalated"] as const;
export type AnomalyStatus = (typeof ANOMALY_STATUS)[number];

export const NOTIFICATION_CHANNEL = ["in_app", "email"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNEL)[number];

export const NOTIFICATION_STATUS = ["pending", "sent", "failed", "read"] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUS)[number];

export const COMPLIANCE_CHECK_STATUS = ["pending", "passed", "failed"] as const;
export type ComplianceCheckStatus = (typeof COMPLIANCE_CHECK_STATUS)[number];

export const REPORT_TYPE = ["auction_summary", "compliance", "audit_trail"] as const;
export type ReportType = (typeof REPORT_TYPE)[number];

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
  "IDEMPOTENCY_KEY_REQUIRED",
  "BID_NOT_FOUND",
  "DISPUTE_INVALID_TRANSITION",
  "AUCTION_NOT_CLOSED",
  "RESERVE_NOT_MET",
  "NOTIFICATION_NOT_FOUND",
  "REPORT_NOT_FOUND",
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