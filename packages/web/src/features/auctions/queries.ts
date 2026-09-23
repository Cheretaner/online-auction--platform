import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { auctionsApi } from "@/lib/api/auctions";
import { queryKeys } from "@/lib/query/keys";

export function usePublicAuctions() {
  return useQuery({
    queryKey: queryKeys.auctions.public(),
    queryFn: () => auctionsApi.listPublic(),
    staleTime: QUERY_STALE_TIMES.catalog,
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

export function useAuctionBids(auctionId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.auctions.bids(auctionId ?? ""),
    queryFn: () => auctionsApi.listBids(auctionId!),
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
    openSealed: useMutation({ mutationFn: () => auctionsApi.openSealed(id), onSuccess: invalidate }),
  };
}

export function useCreateAuctionItem(auctionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateAuctionItemRequest) => auctionsApi.createItem(auctionId, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.auctions.items(auctionId) }),
  });
}

export function useUpdateAuctionItem(auctionId: string, itemId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateAuctionItemRequest) => auctionsApi.updateItem(auctionId, itemId, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.auctions.items(auctionId) }),
  });
}

export function useDeleteAuctionItem(auctionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => auctionsApi.deleteItem(auctionId, itemId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.auctions.items(auctionId) }),
  });
}

export function usePlaceBid(auctionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: PlaceBidRequest) =>
      auctionsApi.placeBid(auctionId, body, crypto.randomUUID()),
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
