import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CancelAuctionRequest,
  CreateAuctionItemRequest,
  CreateAuctionRequest,
  PlaceBidRequest,
  TransitionAuctionRequest,
  UpdateAuctionItemRequest,
  UpdateAuctionRequest,
  WithdrawBidRequest,
} from "@auction/shared";
import { QUERY_STALE_TIMES } from "@/config/constants";
import { auctionsApi, type PublicAuctionParams } from "@/lib/api/auctions";
import { queryKeys } from "@/lib/query/keys";
import { useAuth } from "@/features/auth/auth-provider";
import { readPrivateBidHistory, savePrivateBidHistory } from "@/lib/query/private-bid-cache";

export function usePublicAuctions(params: PublicAuctionParams = {}) {
  return useQuery({
    queryKey: queryKeys.auctions.public(params),
    queryFn: () => auctionsApi.listPublic(params),
    staleTime: QUERY_STALE_TIMES.catalog,
    placeholderData: keepPreviousData,
  });
}

export function useAuction(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.auctions.detail(id ?? ""),
    queryFn: () => auctionsApi.getById(id!),
    enabled: Boolean(id),
  });
}

export function useOrgAuctions(orgId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.auctions.org(orgId ?? ""),
    queryFn: () => auctionsApi.listByOrg(orgId!),
    enabled: Boolean(orgId),
  });
}

export function useAuctionItems(auctionId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.auctions.items(auctionId ?? ""),
    queryFn: () => auctionsApi.listItems(auctionId!),
    enabled: Boolean(auctionId),
  });
}

export function useAuctionBids(
  auctionId: string | undefined,
  enabled = true,
  options: { cacheOwnHistory?: boolean } = {},
) {
  const { session } = useAuth();
  const viewerId = session?.user.id;
  const cached = options.cacheOwnHistory && viewerId && auctionId
    ? readPrivateBidHistory(viewerId, auctionId)
    : undefined;
  return useQuery({
    queryKey: queryKeys.auctions.bids(auctionId ?? "", viewerId),
    queryFn: async () => {
      const response = await auctionsApi.listBids(auctionId!);
      if (viewerId && options.cacheOwnHistory) savePrivateBidHistory(viewerId, auctionId!, response.items);
      return response;
    },
    initialData: cached?.data,
    initialDataUpdatedAt: cached?.savedAt,
    enabled: Boolean(auctionId) && enabled,
    staleTime: QUERY_STALE_TIMES.short,
  });
}

export function useCreateAuction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateAuctionRequest) => auctionsApi.create(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.auctions.all });
    },
  });
}

export function useUpdateAuction(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateAuctionRequest) => auctionsApi.update(id, body),
    onSuccess: (auction) => {
      queryClient.setQueryData(queryKeys.auctions.detail(id), auction);
      void queryClient.invalidateQueries({ queryKey: queryKeys.auctions.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.reports.historicalInsights(id) });
    },
  });
}

export function useAuctionAction(id: string) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.auctions.detail(id) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.auctions.all });
  };
  return {
    submit: useMutation({ mutationFn: () => auctionsApi.submit(id), onSuccess: invalidate }),
    approve: useMutation({ mutationFn: () => auctionsApi.approve(id), onSuccess: invalidate }),
    transition: useMutation({
      mutationFn: (body: TransitionAuctionRequest) => auctionsApi.transition(id, body),
      onSuccess: invalidate,
    }),
    cancel: useMutation({
      mutationFn: (body: CancelAuctionRequest) => auctionsApi.cancel(id, body),
      onSuccess: invalidate,
    }),
    openSealed: useMutation({
      mutationFn: () => auctionsApi.openSealed(id),
      onSuccess: () => {
        invalidate();
        void queryClient.invalidateQueries({ queryKey: queryKeys.auctions.bids(id) });
      },
    }),
  };
}

export function useCreateAuctionItem(auctionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateAuctionItemRequest) => auctionsApi.createItem(auctionId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.auctions.items(auctionId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.reports.historicalInsights(auctionId) });
    },
  });
}

export function useUpdateAuctionItem(auctionId: string, itemId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateAuctionItemRequest) => auctionsApi.updateItem(auctionId, itemId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.auctions.items(auctionId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.reports.historicalInsights(auctionId) });
    },
  });
}

export function useDeleteAuctionItem(auctionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => auctionsApi.deleteItem(auctionId, itemId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.auctions.items(auctionId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.reports.historicalInsights(auctionId) });
    },
  });
}

/**
 * Places a bid. The caller supplies the Idempotency-Key and must reuse the
 * same key when retrying the same bid (for example after a timeout); a new
 * key per attempt would let a retry place a second bid.
 */
export function usePlaceBid(auctionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ body, idempotencyKey }: { body: PlaceBidRequest; idempotencyKey: string }) =>
      auctionsApi.placeBid(auctionId, body, idempotencyKey),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.auctions.detail(auctionId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.auctions.bids(auctionId) });
    },
  });
}

export function useWithdrawBid(auctionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bidId, body }: { bidId: string; body: WithdrawBidRequest }) =>
      auctionsApi.withdrawBid(auctionId, bidId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.auctions.bids(auctionId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.auctions.detail(auctionId) });
    },
  });
}
