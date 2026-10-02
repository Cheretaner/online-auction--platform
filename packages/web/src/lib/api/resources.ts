import type {
  AssignDisputeRequest,
  AssistRequest,
  CategorizeRequest,
  CreateCategoryRequest,
  CreateDepositRequest,
  DetectAnomalyRequest,
  GenerateReportRequest,
  OpenDisputeRequest,
  ResolveDisputeRequest,
  ReviewAnomalyRequest,
  ReviewDepositRequest,
  ReleaseDepositRequest,
  ReviewVerificationRequest,
  RunComplianceRequest,
  SendNotificationRequest,
  SubmitVerificationRequest,
} from "@auction/shared";
import { apiRequest, v1 } from "@/lib/api/client";
import type {
  AiAnomalyScanResult,
  AiAssistResult,
  AiCategorizationResult,
  AnomalyFlagRecord,
  AuditEvent,
  ComplianceCheckRecord,
  DuplicateCheckResult,
  AutofetchConflictSummary,
  AutofetchFetchResult,
  AutofetchPendingDetail,
  AutofetchPendingResult,
  AutofetchStats,
  AutofetchSource,
  CategoryRecord,
  CountResponse,
  ChapaDepositInitiation,
  ChapaSettlementInitiation,
  DepositRecord,
  FinancialReconciliationSnapshot,
  DisputeRecord,
  DocumentRecord,
  ItemList,
  NotificationRecord,
  ReportRecord,
  SettlementRecord,
  TelegramLinkToken,
  TelegramIntegrationStatus,
  TelegramStatus,
  VerificationRecord,
} from "@/lib/api/types";

function queryString(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    search.set(key, String(value));
  }
  const encoded = search.toString();
  return encoded ? `?${encoded}` : "";
}

export const catalogApi = {
  listCategories: () => apiRequest<ItemList<CategoryRecord>>(v1("/categories")),
  getCategory: (id: string) => apiRequest<CategoryRecord>(v1(`/categories/${id}`)),
  createCategory: (body: CreateCategoryRequest) =>
    apiRequest<CategoryRecord>(v1("/categories"), { method: "POST", body }),
  updateCategory: (id: string, body: Partial<CreateCategoryRequest>) =>
    apiRequest<CategoryRecord>(v1(`/categories/${id}`), { method: "PATCH", body }),
};

export const depositsApi = {
  providers: () => apiRequest<{ chapa: boolean }>(v1("/deposits/providers")),
  create: (body: CreateDepositRequest) =>
    apiRequest<DepositRecord>(v1("/deposits"), { method: "POST", body }),
  initiateChapa: (body: { auctionId: string }) =>
    apiRequest<ChapaDepositInitiation>(v1("/deposits/initiate"), { method: "POST", body }),
  listMine: () => apiRequest<ItemList<DepositRecord>>(v1("/deposits/me")),
  listByAuction: (auctionId: string) =>
    apiRequest<ItemList<DepositRecord>>(v1(`/deposits${queryString({ auctionId })}`)),
  getById: (id: string) => apiRequest<DepositRecord>(v1(`/deposits/${id}`)),
  review: (id: string, body: ReviewDepositRequest) =>
    apiRequest<DepositRecord>(v1(`/deposits/${id}/review`), { method: "POST", body }),
  release: (id: string, body: ReleaseDepositRequest) =>
    apiRequest<DepositRecord>(v1(`/deposits/${id}/release`), { method: "POST", body }),
};

export const settlementsApi = {
  listMine: () => apiRequest<ItemList<SettlementRecord>>(v1("/settlements/me")),
  initiateChapa: (auctionId: string) =>
    apiRequest<ChapaSettlementInitiation>(v1(`/settlements/${auctionId}/initiate`), { method: "POST" }),
};

export const documentsApi = {
  upload: (form: FormData) =>
    apiRequest<DocumentRecord>(v1("/documents"), { method: "POST", body: form }),
  listMine: () => apiRequest<ItemList<DocumentRecord>>(v1("/documents/me")),
  listByAuction: (auctionId: string) =>
    apiRequest<ItemList<DocumentRecord>>(v1(`/documents${queryString({ auctionId })}`)),
  getById: (id: string) => apiRequest<DocumentRecord>(v1(`/documents/${id}`)),
  download: (id: string) => apiRequest<Blob>(v1(`/documents/${id}/content`), { parse: "blob" }),
};

export const verificationApi = {
  submit: (body: SubmitVerificationRequest) =>
    apiRequest<VerificationRecord>(v1("/verifications/submit"), { method: "POST", body }),
  mine: () => apiRequest<VerificationRecord | null>(v1("/verifications/me")),
  pending: () => apiRequest<ItemList<VerificationRecord>>(v1("/verifications/pending")),
  review: (id: string, body: ReviewVerificationRequest) =>
    apiRequest<VerificationRecord>(v1(`/verifications/${id}/review`), { method: "POST", body }),
  duplicates: (userId: string) =>
    apiRequest<DuplicateCheckResult>(v1(`/verifications/users/${userId}/duplicates`)),
};

export const notificationsApi = {
  list: (unread?: boolean) =>
    apiRequest<ItemList<NotificationRecord>>(
      v1(`/notifications${queryString({ unread: unread ? true : undefined })}`),
    ),
  unreadCount: () => apiRequest<CountResponse>(v1("/notifications/unread-count")),
  markRead: (id: string) => apiRequest<NotificationRecord>(v1(`/notifications/${id}/read`), { method: "POST" }),
  markAllRead: () => apiRequest<{ updated: number }>(v1("/notifications/read-all"), { method: "POST" }),
  send: (body: SendNotificationRequest) =>
    apiRequest<NotificationRecord>(v1("/notifications"), { method: "POST", body }),
};

export const disputesApi = {
  create: (body: OpenDisputeRequest) =>
    apiRequest<DisputeRecord>(v1("/disputes"), { method: "POST", body }),
  list: (auctionId?: string) =>
    apiRequest<ItemList<DisputeRecord>>(v1(`/disputes${queryString({ auctionId })}`)),
  getById: (id: string) => apiRequest<DisputeRecord>(v1(`/disputes/${id}`)),
  assign: (id: string, body: AssignDisputeRequest) =>
    apiRequest<DisputeRecord>(v1(`/disputes/${id}/assign`), { method: "POST", body }),
  resolve: (id: string, body: ResolveDisputeRequest) =>
    apiRequest<DisputeRecord>(v1(`/disputes/${id}/resolve`), { method: "POST", body }),
};

export const reportsApi = {
  generate: (body: GenerateReportRequest) =>
    apiRequest<ReportRecord>(v1("/reports"), { method: "POST", body }),
  list: (auctionId?: string) =>
    apiRequest<ItemList<ReportRecord>>(v1(`/reports${queryString({ auctionId })}`)),
  getById: (id: string) => apiRequest<ReportRecord>(v1(`/reports/${id}`)),
  publish: (id: string) => apiRequest<ReportRecord>(v1(`/reports/${id}/publish`), { method: "POST" }),
  financialReconciliation: (auctionId: string) =>
    apiRequest<FinancialReconciliationSnapshot>(v1(`/reports/financial-reconciliation${queryString({ auctionId })}`)),
};

export const auditApi = {
  events: () => apiRequest<ItemList<AuditEvent>>(v1("/audit/events")),
  verify: () => apiRequest(v1("/audit/verify")),
  verifyAuction: (auctionId: string) => apiRequest(v1(`/audit/auctions/${auctionId}/verify`)),
};

export const complianceApi = {
  runCheck: (auctionId: string, body: RunComplianceRequest) =>
    apiRequest<ComplianceCheckRecord>(v1(`/compliance/auctions/${auctionId}/checks`), { method: "POST", body }),
  listChecks: (auctionId: string) =>
    apiRequest<ItemList<ComplianceCheckRecord>>(v1(`/compliance/auctions/${auctionId}/checks`)),
};

export const aiApi = {
  categorize: (body: CategorizeRequest) =>
    apiRequest<AiCategorizationResult>(v1("/ai/categorize"), { method: "POST", body }),
  /** Explicit, user-triggered risk scan: deterministic flag + AI narrative advisory. */
  detectAnomaly: (body: DetectAnomalyRequest) =>
    apiRequest<AiAnomalyScanResult>(v1("/ai/anomaly"), { method: "POST", body }),
  listAnomalies: (auctionId?: string) =>
    apiRequest<ItemList<AnomalyFlagRecord>>(v1(`/ai/anomalies${queryString({ auctionId })}`)),
  reviewAnomaly: (id: string, body: ReviewAnomalyRequest) =>
    apiRequest<AnomalyFlagRecord>(v1(`/ai/anomalies/${id}/review`), { method: "POST", body }),
  assist: (body: AssistRequest) =>
    apiRequest<AiAssistResult>(v1("/ai/assist"), { method: "POST", body, timeoutMs: 45_000 }),
};

function unwrap<T>(promise: Promise<{ data: T }>): Promise<T> {
  return promise.then((response) => response.data);
}

export const telegramApi = {
  createLinkToken: () =>
    unwrap(apiRequest<{ data: TelegramLinkToken }>(v1("/telegram/link-token"), { method: "POST" })),
  status: () => unwrap(apiRequest<{ data: TelegramStatus }>(v1("/telegram/status"))),
  integrationStatus: () =>
    unwrap(apiRequest<{ data: TelegramIntegrationStatus }>(v1("/telegram/integration-status"), { timeoutMs: 30_000 })),
  unlink: () =>
    unwrap(apiRequest<{ data: { unlinked: boolean } }>(v1("/telegram/unlink"), { method: "DELETE" })),
  /** Publishes (or edits) the auction card on the public Telegram channel. */
  broadcast: (auctionId: string) =>
    unwrap(
      apiRequest<{ data: { broadcasted: boolean } }>(v1(`/telegram/broadcast/${auctionId}`), {
        method: "POST",
        timeoutMs: 30_000,
      }),
    ),
};

export const autofetchApi = {
  listSources: () => unwrap(apiRequest<{ data: AutofetchSource[] }>(v1("/autofetch/sources"))),
  createSource: (body: {
    name: string;
    adapterType: string;
    sourceUrl?: string;
    adapterConfig?: Record<string, unknown>;
  }) => unwrap(apiRequest<{ data: AutofetchSource }>(v1("/autofetch/sources"), { method: "POST", body })),
  fetchSource: (sourceId: string) =>
    unwrap(apiRequest<{ data: AutofetchFetchResult }>(v1(`/autofetch/sources/${sourceId}/fetch`), { method: "POST" })),
  pending: (params?: { limit?: number; offset?: number; status?: string; sourceId?: string }) =>
    unwrap(apiRequest<{ data: AutofetchPendingResult }>(v1(`/autofetch/pending${queryString(params ?? {})}`))),
  getPending: (id: string) => unwrap(apiRequest<{ data: AutofetchPendingDetail }>(v1(`/autofetch/pending/${id}`))),
  conflicts: (id: string) => unwrap(apiRequest<{ data: AutofetchConflictSummary }>(v1(`/autofetch/pending/${id}/conflicts`))),
  approve: (id: string, auctionId: string) =>
    unwrap(apiRequest<{ data: unknown }>(v1(`/autofetch/pending/${id}/approve`), { method: "POST", body: { auctionId } })),
  reject: (id: string, reason: string) =>
    unwrap(apiRequest<{ data: unknown }>(v1(`/autofetch/pending/${id}/reject`), { method: "POST", body: { reason } })),
  stats: () => unwrap(apiRequest<{ data: AutofetchStats }>(v1("/autofetch/stats"))),
};

export const healthApi = {
  live: () => apiRequest("/health", { skipAuth: true }),
};
