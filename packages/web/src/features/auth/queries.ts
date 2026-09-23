import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LoginRequest, RegisterRequest, Role, UpdateProfileRequest } from "@auction/shared";
import { QUERY_STALE_TIMES } from "@/config/constants";
import { authApi } from "@/lib/api/auth";
import { tokenStore } from "@/lib/auth/token-store";
import type { AuthSession } from "@/lib/api/types";
import { queryKeys } from "@/lib/query/keys";

function persistSession(session: AuthSession) {
  tokenStore.setSession(session);
  return session;
}

export function useSessionQuery() {
  return useQuery({
    queryKey: queryKeys.session,
    queryFn: async (): Promise<AuthSession | null> => {
      const stored = tokenStore.getSession();
      if (!tokenStore.getRefreshToken() && !tokenStore.getAccessToken()) return null;
      try {
        const user = await authApi.me();
        if (stored) {
          const next = { ...stored, user };
          tokenStore.setSession(next);
          return next;
        }
        return stored;
      } catch {
        const refreshToken = tokenStore.getRefreshToken();
        if (!refreshToken) {
          tokenStore.clear();
          return null;
        }
        try {
          return persistSession(await authApi.refresh(refreshToken));
        } catch {
          tokenStore.clear();
          return null;
        }
      }
    },
    staleTime: QUERY_STALE_TIMES.short,
    retry: false,
  });
}

export function useLoginMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: LoginRequest) => authApi.login(body).then(persistSession),
    onSuccess: (session) => {
      queryClient.setQueryData(queryKeys.session, session);
      queryClient.setQueryData(queryKeys.me, session.user);
    },
  });
}

export function useRegisterMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: RegisterRequest) => authApi.register(body).then(persistSession),
    onSuccess: (session) => {
      queryClient.setQueryData(queryKeys.session, session);
      queryClient.setQueryData(queryKeys.me, session.user);
    },
  });
}

export function useUpdateProfileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateProfileRequest) => authApi.updateMe(body),
    onSuccess: (user) => {
      queryClient.setQueryData(queryKeys.me, user);
      const session = queryClient.getQueryData<AuthSession | null>(queryKeys.session);
      if (session) {
        const next = { ...session, user };
        tokenStore.setSession(next);
        queryClient.setQueryData(queryKeys.session, next);
      }
    },
  });
}

export function useSwitchOrgMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (organizationId: string) => authApi.switchContext(organizationId).then(persistSession),
    onSuccess: async (session) => {
      queryClient.setQueryData(queryKeys.session, session);
      await queryClient.invalidateQueries();
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return () => {
    tokenStore.clear();
    queryClient.setQueryData(queryKeys.session, null);
    queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== "auctions" && query.queryKey[0] !== "categories" && query.queryKey[0] !== "organizations" && query.queryKey[0] !== "health" });
  };
}

export function sessionRoles(session: AuthSession | null | undefined): Role[] {
  return session?.roles ?? [];
}
