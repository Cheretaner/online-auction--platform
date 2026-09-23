import { useEffect } from "react";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import type { Role } from "@auction/shared";
import { setUnauthorizedHandler } from "@/lib/api/client";
import { tokenStore } from "@/lib/auth/token-store";
import type { AuthSession } from "@/lib/api/types";
import { queryKeys } from "@/lib/query/keys";
import { useSessionQuery } from "@/features/auth/queries";

interface AuthContextValue {
  session: AuthSession | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  roles: Role[];
  organizationId: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const query = useSessionQuery();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    setUnauthorizedHandler(() => {
      tokenStore.clear();
      queryClient.setQueryData(queryKeys.session, null);
      navigate("/login", { replace: true });
    });
    return () => setUnauthorizedHandler(null);
  }, [navigate, queryClient]);

  const value = useMemo<AuthContextValue>(() => {
    const session = query.data ?? null;
    return {
      session,
      isLoading: query.isLoading,
      isAuthenticated: Boolean(session?.token),
      roles: session?.roles ?? [],
      organizationId: session?.organizationId ?? null,
    };
  }, [query.data, query.isLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
