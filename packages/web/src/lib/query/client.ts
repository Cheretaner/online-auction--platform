import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/errors";
import { QUERY_STALE_TIMES } from "@/config/constants";

function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError) {
    if ([400, 401, 403, 404, 409, 422].includes(error.status)) return false;
    if (error.status === 0) return failureCount < 1;
  }
  return failureCount < 2;
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: QUERY_STALE_TIMES.default,
        gcTime: 5 * 60_000,
        retry: shouldRetry,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
