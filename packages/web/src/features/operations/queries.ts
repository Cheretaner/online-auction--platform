import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AddOrganizationMemberRequest,
  AssignDisputeRequest,
  ResolveDisputeRequest,
  CreateCategoryRequest,
  CreateDepositRequest,
  CreateOrganizationRequest,
  CreateUserRequest,
  GenerateReportRequest,
  OpenDisputeRequest,
  ReviewDepositRequest,
  ReleaseDepositRequest,
  ReviewVerificationRequest,
  SubmitVerificationRequest,
} from "@auction/shared";
import { QUERY_STALE_TIMES } from "@/config/constants";
import {
  auditApi,
  catalogApi,
  complianceApi,
  depositsApi,
  disputesApi,
  documentsApi,
  notificationsApi,
  reportsApi,
  watchlistsApi,
  settlementsApi,
  verificationApi,
  autofetchApi,
  platformApi,
  commandCenterApi,
} from "@/lib/api/resources";
import { organizationsApi, usersApi } from "@/lib/api/organizations";
import { queryKeys } from "@/lib/query/keys";
import type { AutofetchItemCorrections } from "@/lib/api/types";

export function useCommandCenterExceptions() {
  return useQuery({
    queryKey: queryKeys.operations.exceptions,
    queryFn: () => commandCenterApi.exceptions(),
  });
}

export function useOrganizations() {
  return useQuery({
    queryKey: queryKeys.organizations.list(),
    queryFn: () => organizationsApi.list(),
    staleTime: QUERY_STALE_TIMES.catalog,
  });
}

export function usePlatformCapabilities(enabled = true) {
  return useQuery({
    queryKey: ["platform", "capabilities"],
    queryFn: () => platformApi.capabilities(),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useOrganization(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.organizations.detail(id ?? ""),
    queryFn: () => organizationsApi.getById(id!),
    enabled: Boolean(id),
  });
}

export function useOrgMembers(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.organizations.members(id ?? ""),
    queryFn: () => organizationsApi.listMembers(id!),
    enabled: Boolean(id) && enabled,
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateOrganizationRequest) =>
      organizationsApi.create(body),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations.all }),
  });
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof organizationsApi.update>[1] }) =>
      organizationsApi.update(id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.organizations.all }),
  });
}

export function useDeleteOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => organizationsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.organizations.all }),
  });
}

export function useArchiveGeneratedOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => organizationsApi.archiveGenerated(id),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.organizations.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.auctions.all }),
      ]),
  });
}

export function useUsers() {
  return useQuery({
    queryKey: queryKeys.users.list(),
    queryFn: () => usersApi.list(),
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateUserRequest) => usersApi.create(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.users.all }),
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof usersApi.update>[1] }) =>
      usersApi.update(id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.users.all }),
  });
}

export function useDeactivateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => usersApi.deactivate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.users.all }),
  });
}

export function useAddOrgMember(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AddOrganizationMemberRequest) =>
      organizationsApi.addMember(id, body),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.organizations.members(id),
      }),
  });
}

export function useRemoveOrgMember(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => organizationsApi.removeMember(id, userId),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.organizations.members(id),
      }),
  });
}

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories.all,
    queryFn: () => catalogApi.listCategories(),
    staleTime: QUERY_STALE_TIMES.long,
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCategoryRequest) =>
      catalogApi.createCategory(body),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all }),
  });
}

export function useUpdateCategory(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<CreateCategoryRequest>) => catalogApi.updateCategory(id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.categories.all }),
  });
}

export function useMyVerification() {
  return useQuery({
    queryKey: queryKeys.verification.mine,
    queryFn: () => verificationApi.mine(),
  });
}

export function usePendingVerifications(enabled = true) {
  return useQuery({
    queryKey: queryKeys.verification.pending,
    queryFn: () => verificationApi.pending(),
    enabled,
  });
}

export function useSubmitVerification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SubmitVerificationRequest) =>
      verificationApi.submit(body),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.verification.mine }),
  });
}

export function useReviewVerification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: ReviewVerificationRequest;
    }) => verificationApi.review(id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["verification"] }),
  });
}

export function useVerificationDuplicates(userId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.verification.duplicates(userId ?? ""),
    queryFn: () => verificationApi.duplicates(userId!),
    enabled: Boolean(userId) && enabled,
  });
}

export function useMyDeposits() {
  return useQuery({
    queryKey: queryKeys.deposits.mine,
    queryFn: () => depositsApi.listMine(),
    refetchInterval: 15_000,
    staleTime: QUERY_STALE_TIMES.short,
  });
}

export function useDepositPaymentProviders() {
  return useQuery({
    queryKey: ["deposits", "providers"],
    queryFn: () => depositsApi.providers(),
    staleTime: QUERY_STALE_TIMES.long,
  });
}

export function useAuctionDeposits(
  auctionId: string | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.deposits.auction(auctionId ?? ""),
    queryFn: () => depositsApi.listByAuction(auctionId!),
    enabled: Boolean(auctionId) && enabled,
  });
}

export function useCreateDeposit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateDepositRequest) => depositsApi.create(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["deposits"] }),
  });
}

export function useInitiateChapaDeposit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { auctionId: string }) => depositsApi.initiateChapa(body),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["deposits"] }),
  });
}

export function useMySettlements(enabled = true) {
  return useQuery({
    queryKey: ["settlements", "mine"],
    queryFn: () => settlementsApi.listMine(),
    enabled,
    staleTime: QUERY_STALE_TIMES.short,
    refetchInterval: enabled ? 15_000 : false,
  });
}

export function useReviewDeposit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ReviewDepositRequest }) =>
      depositsApi.review(id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["deposits"] }),
  });
}

export function useReleaseDeposit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ReleaseDepositRequest }) => depositsApi.release(id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["deposits"] }),
  });
}

export function useMyDocuments() {
  return useQuery({
    queryKey: queryKeys.documents.mine,
    queryFn: () => documentsApi.listMine(),
  });
}

export function useAuctionDocuments(
  auctionId: string | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.auctions.documents(auctionId ?? ""),
    queryFn: () => documentsApi.listByAuction(auctionId!),
    enabled: Boolean(auctionId) && enabled,
  });
}

export function useDocumentAccessStatus(auctionId: string | undefined, enabled = true, viewerId?: string) {
  return useQuery({
    queryKey: ["document-access", auctionId ?? "", viewerId ?? ""],
    queryFn: async () => {
      const status = await documentsApi.accessStatus(auctionId!);
      return status.status === "pending"
        ? documentsApi.verifyAccess(auctionId!)
        : status;
    },
    enabled: Boolean(auctionId) && enabled,
    refetchOnWindowFocus: true,
  });
}

export function useInitiateDocumentAccess(auctionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => documentsApi.initiateAccess(auctionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["document-access", auctionId] }),
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (form: FormData) => documentsApi.upload(form),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["documents"] }),
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => documentsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["documents"] }),
  });
}

export function useNotifications(unread?: boolean) {
  return useQuery({
    queryKey: queryKeys.notifications.list(unread),
    queryFn: () => notificationsApi.list(unread),
    staleTime: QUERY_STALE_TIMES.short,
  });
}

export function useUnreadCount(enabled = true) {
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount,
    queryFn: () => notificationsApi.unreadCount(),
    enabled,
    refetchInterval: enabled ? 30_000 : false,
    staleTime: QUERY_STALE_TIMES.short,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useDisputes(auctionId?: string) {
  return useQuery({
    queryKey: queryKeys.disputes.list(auctionId),
    queryFn: () => disputesApi.list(auctionId),
  });
}

export function useCreateDispute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: OpenDisputeRequest) => disputesApi.create(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["disputes"] }),
  });
}

export function useAssignDispute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: AssignDisputeRequest }) => disputesApi.assign(id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["disputes"] }),
  });
}

export function useResolveDispute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ResolveDisputeRequest }) => disputesApi.resolve(id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["disputes"] }),
  });
}

export function useReports(auctionId?: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.reports.list(auctionId),
    queryFn: () => reportsApi.list(auctionId),
    enabled,
  });
}

export function useFinancialReconciliation(auctionId: string, enabled = true) {
  return useQuery({
    queryKey: ["reports", "financial-reconciliation", auctionId],
    queryFn: () => reportsApi.financialReconciliation(auctionId),
    enabled: Boolean(auctionId) && enabled,
    staleTime: QUERY_STALE_TIMES.short,
  });
}

export function useReport(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.reports.detail(id ?? ""),
    queryFn: () => reportsApi.getById(id!),
    enabled: Boolean(id),
  });
}

export function useGenerateReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: GenerateReportRequest) => reportsApi.generate(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reports"] }),
  });
}

export function usePublishReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => reportsApi.publish(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reports"] }),
  });
}

export function useAuditEvents(page = 1, limit = 50, enabled = true) {
  return useQuery({
    queryKey: queryKeys.audit.events(page, limit),
    queryFn: () => auditApi.events(page, limit),
    enabled,
  });
}

export function useAuditVerify(enabled = true) {
  return useQuery({
    queryKey: queryKeys.audit.verify,
    queryFn: () => auditApi.verify(),
    enabled,
  });
}

export function useComplianceChecks(
  auctionId: string | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.compliance.checks(auctionId ?? ""),
    queryFn: () => complianceApi.listChecks(auctionId!),
    enabled: Boolean(auctionId) && enabled,
  });
}

export function useRunCompliance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ auctionId, notes }: { auctionId: string; notes?: string }) =>
      complianceApi.runCheck(auctionId, { notes }),
    onSuccess: (_data, vars) =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.compliance.checks(vars.auctionId),
      }),
  });
}

export function useAutofetchSources(enabled = true) {
  return useQuery({
    queryKey: queryKeys.autofetch.sources,
    queryFn: () => autofetchApi.listSources(),
    enabled,
  });
}

export function useCreateAutofetchSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; adapterType: string; sourceUrl?: string; adapterConfig?: Record<string, unknown> }) => autofetchApi.createSource(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.autofetch.sources }),
  });
}

export function useUpdateAutofetchSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sourceId, body }: {
      sourceId: string;
      body: { name: string; adapterType: string; sourceUrl?: string; adapterConfig: Record<string, unknown>; isActive: boolean };
    }) => autofetchApi.updateSource(sourceId, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.autofetch.sources }),
  });
}

export function useRemoveAutofetchSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sourceId: string) => autofetchApi.removeSource(sourceId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.autofetch.sources }),
  });
}

export function useFetchAutofetchSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sourceId: string) => autofetchApi.fetchSource(sourceId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.autofetch.sources });
      void queryClient.invalidateQueries({ queryKey: ["autofetch", "pending"] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.autofetch.stats });
    },
  });
}

export function useAutofetchPending(offset = 0, enabled = true) {
  return useQuery({
    queryKey: queryKeys.autofetch.pending({ status: "pending", offset }),
    queryFn: () => autofetchApi.pending({ status: "pending", limit: 5, offset }),
    enabled,
  });
}

export function useDownloadDisputeEvidenceBundle() {
  return useMutation({ mutationFn: (id: string) => disputesApi.downloadEvidenceBundle(id) });
}

export function useHistoricalAuctionInsights(auctionId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.reports.historicalInsights(auctionId),
    queryFn: () => reportsApi.historicalInsights(auctionId),
    enabled: Boolean(auctionId) && enabled,
    staleTime: QUERY_STALE_TIMES.long,
  });
}

export function useAutofetchPendingDetail(id: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.autofetch.pendingDetail(id),
    queryFn: () => autofetchApi.getPending(id),
    enabled: Boolean(id) && enabled,
  });
}

export function useWatchlists(enabled = true) {
  return useQuery({ queryKey: queryKeys.watchlists.mine, queryFn: () => watchlistsApi.list(), enabled });
}

export function useSaveWatchlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ auctionId, body }: {
      auctionId: string;
      body: { channels: Array<"in_app" | "email" | "telegram">; alertOnBids: boolean; alertOnStatus: boolean };
    }) => watchlistsApi.save(auctionId, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.watchlists.mine }),
  });
}

export function useRemoveWatchlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (auctionId: string) => watchlistsApi.remove(auctionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.watchlists.mine }),
  });
}

export function useDocumentOcr(id: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.documents.ocr(id),
    queryFn: () => documentsApi.getOcr(id).then((result) => result.item),
    enabled,
    refetchInterval: (query) => query.state.data?.status === "processing" ? 2_000 : false,
  });
}

export function useSearchReviewedOcr(auctionId: string, q: string) {
  return useQuery({
    queryKey: queryKeys.documents.ocrSearch(auctionId, q),
    queryFn: () => documentsApi.searchOcr(auctionId, q),
    enabled: q.trim().length >= 2,
  });
}

export function useStartDocumentOcr(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => documentsApi.startOcr(id),
    onSuccess: ({ item }) => queryClient.setQueryData(queryKeys.documents.ocr(id), item),
  });
}

export function useReviewDocumentOcr(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reviewedText: string) => documentsApi.reviewOcr(id, reviewedText),
    onSuccess: ({ item }) => queryClient.setQueryData(queryKeys.documents.ocr(id), item),
  });
}

export function useReviewDepositReferenceOcr(documentId: string) {
  return useMutation({ mutationFn: (candidate: string) => documentsApi.reviewOcrReference(documentId, candidate) });
}

export function useAutofetchConflicts(id: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.autofetch.conflicts(id),
    queryFn: () => autofetchApi.conflicts(id),
    enabled: Boolean(id) && enabled,
  });
}

export function useAutofetchStats(enabled = true) {
  return useQuery({
    queryKey: queryKeys.autofetch.stats,
    queryFn: () => autofetchApi.stats(),
    enabled,
  });
}

export function useApproveAutofetchItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, auctionId, corrections }: { id: string; auctionId: string; corrections?: AutofetchItemCorrections }) => autofetchApi.approve(id, auctionId, corrections),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["autofetch", "pending"] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.autofetch.stats });
      void queryClient.invalidateQueries({ queryKey: queryKeys.auctions.all });
    },
  });
}

export function useRejectAutofetchItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => autofetchApi.reject(id, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["autofetch", "pending"] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.autofetch.stats });
    },
  });
}
