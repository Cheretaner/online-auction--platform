import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AssistRequest, CategorizeRequest, ReviewAnomalyRequest } from "@auction/shared";
import { aiApi } from "@/lib/api/resources";
import { queryKeys } from "@/lib/query/keys";

/** Rule-based anomaly flags, optionally scoped to a single auction. */
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
    mutationFn: (input: string | AssistRequest) =>
      aiApi.assist(typeof input === "string" ? { prompt: input } : input),
  });
}

/** Lot text plus, when known, the auction whose lots should be refreshed. */
export type AiCategorizeInput = CategorizeRequest & { auctionId?: string };


export function useAiCategorize() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ text, itemId }: AiCategorizeInput) => aiApi.categorize({ text, itemId }),
    onSuccess: (_result, { auctionId }) => {
      if (auctionId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.auctions.items(auctionId) });
      }
    },
  });
}


export function useAiScan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (auctionId: string) => aiApi.detectAnomaly({ auctionId }),
    onSuccess: (result, auctionId) => {
      queryClient.setQueryData(queryKeys.ai.scan(auctionId), result);
      void queryClient.invalidateQueries({ queryKey: queryKeys.ai.anomalies(auctionId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.auctions.all });
    },
  });
}

/** The most recent cached scan for an auction. Read-only: never fetches by itself. */
export function useAiScanResult(auctionId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.ai.scan(auctionId ?? ""),
    queryFn: () => aiApi.detectAnomaly({ auctionId: auctionId ?? "" }),
    enabled: false,
  });
}
