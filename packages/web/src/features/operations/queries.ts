import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AddOrganizationMemberRequest,
  AssignDisputeRequest,
  ResolveDisputeRequest,
  ReviewAnomalyRequest,
  CreateCategoryRequest,
  CreateDepositRequest,
  CreateOrganizationRequest,
  GenerateReportRequest,
  OpenDisputeRequest,
  ReviewDepositRequest,
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
  telegramApi,
  verificationApi,
  autofetchApi,
  aiApi,
} from "@/lib/api/resources";
import { organizationsApi } from "@/lib/api/organizations";
import { queryKeys } from "@/lib/query/keys";

export function useOrganizations() {
  return useQuery({
    queryKey: queryKeys.organizations.list(),
    queryFn: () => organizationsApi.list(),
    staleTime: QUERY_STALE_TIMES.catalog,
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
    mutationFn: (id: string) => depositsApi.release(id),
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

export function useUploadDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (form: FormData) => documentsApi.upload(form),
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

export function useAuditEvents(enabled = true) {
  return useQuery({
    queryKey: queryKeys.audit.events,
    queryFn: () => auditApi.events(),
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

export function useTelegramStatus(enabled = true) {
  return useQuery({
    queryKey: queryKeys.telegram.status,
    queryFn: () => telegramApi.status(),
    enabled,
  });
}

export function useAutofetchSources(enabled = true) {
  return useQuery({
    queryKey: queryKeys.autofetch.sources,
    queryFn: () => autofetchApi.listSources(),
    enabled,
  });
}

export function useAutofetchPending(enabled = true) {
  return useQuery({
    queryKey: queryKeys.autofetch.pending(),
    queryFn: () => autofetchApi.pending(),
    enabled,
  });
}

export function useAutofetchStats(enabled = true) {
  return useQuery({
    queryKey: queryKeys.autofetch.stats,
    queryFn: () => autofetchApi.stats(),
    enabled,
  });
}

export function useAiAnomalies(auctionId?: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.ai.anomalies(auctionId),
    queryFn: () => aiApi.listAnomalies(auctionId),
    enabled,
  });
}

export function useReviewAnomaly() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ReviewAnomalyRequest }) => aiApi.reviewAnomaly(id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ai"] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.auctions.all });
    },
  });
}

export function useAiAssist() {
  return useMutation({
    mutationFn: (prompt: string) => aiApi.assist({ prompt }),
  });
}
