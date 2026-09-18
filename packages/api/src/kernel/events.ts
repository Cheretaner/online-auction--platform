export const DOMAIN_EVENTS = {
  BID_PLACED: "bid.placed",
  BID_WITHDRAWN: "bid.withdrawn",
  AUCTION_EXTENDED: "auction.extended",
  SEALED_OPENED: "sealed.opened",
  DISPUTE_OPENED: "dispute.opened",
  DISPUTE_UPDATED: "dispute.updated",
  ANOMALY_FLAGGED: "anomaly.flagged",
  COMPLIANCE_CHECKED: "compliance.checked",
  REPORT_GENERATED: "report.generated",
  REPORT_PUBLISHED: "report.published",
  NOTIFICATION_QUEUED: "notification.queued",
} as const;

export type DomainEventType = (typeof DOMAIN_EVENTS)[keyof typeof DOMAIN_EVENTS];

export const GENESIS_HASH = "0".repeat(64);

export const GLOBAL_LEDGER_SCOPE = "00000000-0000-0000-0000-000000000000";
