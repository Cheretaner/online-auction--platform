import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { telegramApi } from "@/lib/api/resources";
import { queryKeys } from "@/lib/query/keys";


export function useTelegramStatus(enabled = true, refetchInterval?: number | false) {
  return useQuery({
    queryKey: queryKeys.telegram.status,
    queryFn: () => telegramApi.status(),
    enabled,
    refetchInterval,
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
