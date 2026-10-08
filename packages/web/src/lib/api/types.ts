import type {
  AccountType,
  AuctionStatus,
  AuctionType,
  CreateAuctionItemRequest,
  DocumentType,
  OrgType,
  Role,
  VerificationStatus,
} from "@auction/shared";

export interface PublicProfile {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  accountType: AccountType;
  businessName: string | null;
  region: string | null;
  preferredLanguage: "en" | "am" | null;
  verificationStatus: VerificationStatus;
  platformRole: Role | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationMembership {
  organizationId: string;
  organizationName: string;
  role: Role;
}

export interface AuthSession {
  user: PublicProfile;
  roles: Role[];
  organizationId: string | null;
  organizations: OrganizationMembership[];
  token: string;
  refreshToken: string;
  expiresIn: string;
}

export interface Auction {
  id: string;
  orgId: string;
  title: string;
  description: string | null;
  auctionType: AuctionType;
  status: AuctionStatus;
  startPrice: string;
  reservePrice: string | null;
  minIncrement: string;
  currentHighestBid: string | null;
  bidCount: number;
  depositAmount: string;
  documentAccessFee: string;
  eligibilityRules: string | null;
  region: string | null;
  antiSnipeSeconds: number;
  maxExtensions: number;
  sealedOpenedAt: string | null;
  closedAt: string | null;
  awardedAt: string | null;
  cancellationReason: string | null;
  opensAt: string;
  closesAt: string;
  originalClosesAt: string;
  extensionCount: number;
  createdBy: string;
  approvedBy: string | null;
  winnerId: string | null;
  winningAmount: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ItemList<T> {
  items: T[];
}

/** One page of GET /auctions. */
export interface AuctionPage extends ItemList<Auction> {
  total: number;
  limit: number;
  offset: number;
}

export interface CountResponse {
  count: number;
}

export interface OrganizationRecord {
  id: string;
  name: string;
  slug: string;
  orgType: OrgType;
  taxpayerId: string;
  region: string;
  contactEmail: string;
  contactPhone: string;
  logoUrl?: string | null;
  isActive: boolean;
  onboardedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ArchiveGeneratedOrganizationResult {
  organization: OrganizationRecord;
  cancelledAuctions: number;
}

export interface OrganizationMember {
  userId: string;
  email?: string;
  fullName?: string;
  role: Role;
}

export interface AdminUserRecord extends PublicProfile {
  roles: Role[];
}

export interface AuctionItem {
  id: string;
  auctionId: string;
  title: string;
  description: string | null;
  quantity: number;
  unit: string | null;
  condition: string | null;
  estimatedValue: string | null;
  categoryId: string | null;
  categorySource: string | null;
  /** Latest AI category suggestion, kept for audit even when unapplied. */
  aiCategorySuggestion?: string | null;
  aiSubCategory?: string | null;
  aiConfidence?: number | null;
  region: string | null;
  city: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A bid as GET /auctions/:id/bids returns it (bidding.visibility.ts):
 * sealed amounts and other bidders' ids are hidden until bids are opened. */
export interface BidRecord {
  id: string;
  auctionId: string;
  bidderId: string;
  amount: string | null;
  status: "active" | "withdrawn" | "superseded";
  isSealed: boolean;
  placedAt: string;
  redacted: boolean;
}

export interface DocumentRecord {
  id: string;
  auctionId: string | null;
  uploadedBy: string;
  documentType: DocumentType;
  fileName: string;
  storagePath?: string;
  mimeType: string;
  fileSizeBytes: number;
  checksumSha256?: string;
  isPrivate: boolean;
  requiresPayment: boolean;
  summary: string | null;
  extractedText: string | null;
  ocrStatus: string;
  createdAt: string;
  updatedAt: string;
}

export interface DepositRecord {
  id: string;
  auctionId: string;
  bidderId: string;
  amount: string;
  referenceNumber: string;
  issuingBank: string;
  instrumentType: string;
  status: "pending" | "verified" | "rejected" | "released";
  documentId: string | null;
  verifiedBy: string | null;
  verifiedAt: string | null;
  releasedAt: string | null;
  rejectionReason: string | null;
  releaseReferenceNumber: string | null;
  releaseDocumentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChapaDepositInitiation {
  depositId: string;
  txRef: string;
  checkoutUrl: string | null;
  status: string;
}

export interface SettlementRecord {
  id: string;
  auctionId: string;
  winnerId: string;
  amount: string;
  currency: "ETB";
  status: "due" | "payment_pending" | "paid" | "cancelled" | "reconciliation_required";
  dueAt: string;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentAccessInitiation {
  status: "pending" | "succeeded";
  checkoutUrl: string | null;
  txRef: string;
}

export interface DocumentAccessStatus {
  required: boolean;
  paid: boolean;
  status: "not_required" | "not_purchased" | "pending" | "succeeded" | "failed" | "reconciliation_required";
  amount: string;
  paidAt: string | null;
  checkoutUrl: string | null;
}

export interface RefundLetter {
  id: string;
  auctionId: string;
  letterNumber: string;
  body: string;
  officialStamp: string;
  createdAt: string;
}

export interface FinancialReconciliationSnapshot {
  auctionId: string;
  generatedAt: string;
  snapshotSha256: string;
  deposits: Array<{ status: string; instrumentType: string; count: string; amount: string }>;
  providerPayments: Array<{ status: string; count: string; amount: string }>;
  providerRefunds: Array<{ status: string; count: string; amount: string }>;
  settlements: Array<{ status: string; count: string; amount: string }>;
  exceptions: Array<{ issue: string; entityId: string; txRef: string | null; amount: string }>;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  channel: string;
  type: string;
  title: string;
  message: string;
  status: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  createdAt: string;
  readAt: string | null;
}

export interface DisputeRecord {
  id: string;
  auctionId: string;
  raisedBy: string;
  reason: string;
  evidence: Record<string, unknown>;
  status: "open" | "under_review" | "resolved" | "rejected";
  assignedReviewer: string | null;
  decision: string | null;
  decisionReason: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportRecord {
  id: string;
  auctionId: string;
  reportType: string;
  reportVersion: number;
  chainHead: string | null;
  chainVerified: boolean;
  reportData: Record<string, unknown>;
  publishedAt: string | null;
  createdAt: string;
}

export interface CategoryRecord {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VerificationRecord {
  id: string;
  userId: string;
  documentType: string;
  documentNumber: string;
  documentId: string | null;
  status: VerificationStatus;
  decision: string | null;
  decisionReason: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CommandCenterException {
  id: string;
  source: "verification" | "deposit" | "dispute" | "anomaly";
  title: string;
  status: string;
  severity: "low" | "medium" | "high";
  createdAt: string;
  updatedAt: string;
  auctionId: string | null;
  actionPath: string;
}

export interface AuditEvent {
  id: string;
  auctionId: string | null;
  actorId: string | null;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  sequenceNo: number;
  payload: Record<string, unknown>;
  prevHash: string;
  hash: string;
  occurredAt: string;
}

export interface AuditEventPage {
  items: AuditEvent[];
  total: number;
}

export interface AuditChainVerification {
  intact: boolean;
  eventCount: number;
  headHash: string | null;
  brokenAtSequence?: number;
  error?: string;
}

/** Mirrors telegramService.getTelegramLinkStatus (GET /telegram/status). */
export interface TelegramStatus {
  linked: boolean;
  telegramId: string | null;
  telegramUsername: string | null;
  telegramLinkedAt: string | null;
}

/** POST /telegram/link-token — the one-shot code plus the t.me deep link. */
export interface TelegramLinkToken {
  token: string;
  deepLink: string;
  expiresAt: string;
}

export interface TelegramIntegrationStatus {
  bot: {
    configured: boolean;
    status: "not_configured" | "connected" | "error";
    username: string | null;
    inboundTransport: "disabled" | "starting" | "webhook" | "polling" | "error";
    inboundError: string | null;
  };
  channel: {
    configured: boolean;
    status: "not_configured" | "bot_not_configured" | "connected" | "permission_required" | "error";
    title: string | null;
    username: string | null;
    canPost: boolean;
    error: string | null;
  };
}

export interface AutofetchSource {
  id: string;
  name: string;
  adapterType: string;
  sourceUrl?: string | null;
  adapterConfig?: Record<string, unknown>;
  isActive?: boolean;
  lastFetchedAt?: string | null;
  lastFetchAttemptAt?: string;
  lastFetchStatus?: "running" | "success" | "failed";
  lastFetchSummary?: { fetched?: number; queued?: number; duplicates?: number; stale?: number; conflicts?: number; errors?: number };
  lastFetchError?: string;
  nextFetchAt?: string | null;
  createdAt?: string;
}

export interface HistoricalAuctionInsights {
  auctionCount: number;
  awardedCount: number;
  medianWinningPrice: string | null;
  medianBidCount: number | null;
  awardRate: number | null;
  months: number;
  criteria: { auctionType: string; region: string | null; categories: string[] };
}

export interface DocumentOcrResult {
  documentId: string;
  status: "processing" | "completed" | "failed";
  extractedText: string | null;
  extractionMethod: "embedded_text" | "tesseract" | null;
  confidence: number | null;
  referenceCandidates: string[];
  errorMessage: string | null;
  reviewedText: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  updatedAt: string;
}

export interface DocumentOcrSearchHit {
  documentId: string;
  fileName: string;
  mimeType: string;
  excerpt: string;
  reviewedAt: string;
}

export interface DepositReferenceOcrReview {
  candidate: string;
  matchesSubmittedReference: boolean;
}

export interface WatchlistRecord {
  auctionId: string;
  auctionTitle: string;
  auctionStatus: string;
  channel: "in_app" | "email" | "telegram";
  alertOnBids: boolean;
  alertOnStatus: boolean;
  createdAt: string;
}

export interface AutofetchPendingItem {
  id: string;
  sourceId: string;
  source?: string;
  status: string;
  title: string;
  description?: string;
  externalId?: string;
  sourceUrl?: string;
  estimatedValue?: number;
  categoryName?: string;
  confidenceScore?: number;
  aiSuggested?: boolean;
  conflictCount?: number;
  highSeverityConflicts?: number;
  createdAt?: string;
}

export interface AutofetchPendingResult extends ItemList<AutofetchPendingItem> {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}
export interface AutofetchFetchResult { fetched: number; queued: number; duplicates: number; stale: number; conflicts: number; errors: number }
export interface AutofetchPendingDetail { item: AutofetchPendingItem & { description?: string; normalizedMetadata?: Record<string, unknown> }; conflicts: unknown[] }
export interface AutofetchConflictFlag {
  id: string;
  conflictType: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "NONE";
  confidenceScore: number;
  conflictingAuctionId: string | null;
  matchDetails: Record<string, unknown>;
  createdAt: string;
}

export type AutofetchItemCorrections = Partial<Omit<CreateAuctionItemRequest, "categorySource" | "estimatedValue">> & {
  estimatedValue?: string | null;
};
export interface AutofetchConflictSummary { conflicts: AutofetchConflictFlag[]; count: number; critical: number; high: number; medium: number; low: number }
export interface AutofetchStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  published?: number;
  expired?: number;
}

export interface AnomalyFlagRecord {
  id: string;
  auctionId: string;
  subjectAccounts: string[];
  score: string;
  severity: "low" | "medium" | "high";
  status: "open" | "reviewed" | "dismissed" | "escalated";
  triggeredRules: string[];
  featureValues: Record<string, unknown>;
  explanation: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
  relatedHistory?: RelatedAnomalyRecord[];
}

export interface RelatedAnomalyRecord {
  flagId: string;
  auctionId: string;
  auctionTitle: string;
  severity: "low" | "medium" | "high";
  status: "open" | "reviewed" | "dismissed" | "escalated";
  createdAt: string;
  decisionNote: string | null;
  auctionStatus: string;
  awardAmount?: string;
}

/** Mirrors CategorizationResult in packages/api/src/ai/ai.types.ts (POST /ai/categorize). */
export interface AiCategorizationResult {
  /** Slug that exists in the taxonomy, or the cleaned model answer. */
  category: string;
  categoryName: string | null;
  confidence: number;
  /** Which adapter answered ("gemini", "openai-compat", "stub", ...). */
  provider: string;
  /** True when the deterministic stub answered instead of a real model. */
  fallback: boolean;
  /** Whether the answer resolved to a real category row. */
  matched: boolean;
  rawSuggestion: string;
  /** True when the suggestion was written onto the auction item server-side. */
  applied: boolean;
  reason: string;
}

/** POST /ai/assist */
export interface AiAssistResult {
  answer: string;
  provider: string;
  fallback: boolean;
}

/** Narrative risk assessment produced by the model; advisory only. */
export interface AiAnomalyAdvisory {
  flagged: boolean;
  reason?: string;
  provider: string;
}

/** POST /ai/anomaly — the deterministic flag plus the model's advisory. */
export interface AiAnomalyScanResult {
  flagged: boolean;
  flag: AnomalyFlagRecord | null;
  advisory: AiAnomalyAdvisory | null;
}

export interface ComplianceCheckRecord {
  id: string;
  auctionId: string;
  checkedBy: string;
  status: "pending" | "passed" | "failed";
  findings: Array<{ code?: string; message?: string } | string>;
  notes: string | null;
  createdAt: string;
}

export interface DuplicateCheckResult {
  hasDuplicates: boolean;
  duplicates: Array<{ id: string; national_id: string | null; tin_number: string | null }>;
}
