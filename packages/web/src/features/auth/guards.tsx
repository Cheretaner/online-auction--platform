import { Navigate, Outlet, useLocation } from "react-router-dom";
import type { Role } from "@auction/shared";
import { useAuth } from "@/features/auth/auth-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { hasRole } from "@/lib/format";

export function GuestOnly() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return <AuthSplash />;
  if (isAuthenticated) {
    const to = (location.state as { from?: string } | null)?.from ?? "/app";
    return <Navigate to={to} replace />;
  }
  return <Outlet />;
}

export function RequireAuth() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return <AuthSplash />;
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

export function RequireRole({ roles }: { roles: Role[] }) {
  const { roles: current, isLoading } = useAuth();
  if (isLoading) return <AuthSplash />;
  if (!hasRole(current, ...roles)) {
    return <Navigate to="/app" replace />;
  }
  return <Outlet />;
}

function AuthSplash() {
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}
