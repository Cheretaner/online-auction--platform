import type {
  AccountType,
  AuctionStatus,
  AuctionType,
  DocumentType,
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
  nationalId: string | null;
  tinNumber: string | null;
  region: string | null;
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
  orgType: string;
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

export interface OrganizationMember {
  userId: string;
  email?: string;
  fullName?: string;
  role: Role;
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
  storagePath: string;
  mimeType: string;
  fileSizeBytes: number;
  checksumSha256: string;
  isPrivate: boolean;
  summary: string | null;
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
  createdAt: string;
  updatedAt: string;
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
  status: VerificationStatus;
  decision: string | null;
  decisionReason: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuditEvent {
  id: string;
  auctionId: string | null;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  sequenceNo: number;
  hash: string;
  createdAt: string;
}

export interface TelegramStatus {
  linked: boolean;
  telegramUserId?: string | null;
  username?: string | null;
}

export interface AutofetchSource {
  id: string;
  name: string;
  adapterType: string;
  sourceUrl: string | null;
  createdAt?: string;
}

export interface AutofetchPendingItem {
  id: string;
  sourceId: string;
  status: string;
  title?: string;
  payload?: unknown;
  createdAt?: string;
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
