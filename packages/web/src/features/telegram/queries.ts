import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { telegramApi } from "@/lib/api/resources";
import { queryKeys } from "@/lib/query/keys";


export function useTelegramStatus(enabled = true, pendingLinkExpiresAt?: string) {
  return useQuery({
    queryKey: queryKeys.telegram.status,
    queryFn: () => telegramApi.status(),
    enabled,
    refetchInterval: (query) =>
      pendingLinkExpiresAt &&
      !query.state.data?.telegramLinkedAt &&
      Date.parse(pendingLinkExpiresAt) > Date.now()
        ? 5000
        : false,
  });
}

export function useTelegramIntegrationStatus(enabled = true) {
  return useQuery({
    queryKey: queryKeys.telegram.integration,
    queryFn: () => telegramApi.integrationStatus(),
    enabled,
    staleTime: 15_000,
  });
}

/** Mints a one-shot 15 minute code and its t.me deep link. */
export function useTelegramLinkToken() {
  return useMutation({ mutationFn: () => telegramApi.createLinkToken() });
}

export function useTelegramUnlink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => telegramApi.unlink(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.telegram.status });
    },
  });
}


export function useTelegramBroadcast() {
  return useMutation({ mutationFn: (auctionId: string) => telegramApi.broadcast(auctionId) });
}
