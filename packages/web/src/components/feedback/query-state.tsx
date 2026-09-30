import { AlertTriangle, Inbox, WifiOff } from "lucide-react";
import type { ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getErrorMessage, isApiError } from "@/lib/api/errors";

export function PageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-16 w-full" />
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-10 text-center">
      <Inbox className="size-8 text-muted-foreground" aria-hidden />
      <h2 className="text-lg font-semibold">{title}</h2>
      {description ? <p className="max-w-md text-sm text-muted-foreground">{description}</p> : null}
      {action}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  const forbidden = isApiError(error) && error.isForbidden;
  const notFound = isApiError(error) && error.isNotFound;
  const offline = isApiError(error) && error.isOffline;
  const title = forbidden
    ? "You do not have access"
    : notFound
      ? "Not found"
      : offline
        ? "You appear to be offline"
        : "Something went wrong";
  return (
    <Alert variant="destructive">
      <AlertTriangle className="size-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <span>{getErrorMessage(error)}</span>
        {onRetry ? (
          <Button type="button" variant="outline" size="sm" className="w-fit bg-background" onClick={onRetry}>
            Try again
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

export function OfflineBanner({ online }: { online: boolean }) {
  if (online) return null;
  return (
    <div className="flex items-center gap-2 bg-accent px-4 py-2 text-sm text-accent-foreground">
      <WifiOff className="size-4" />
      You are offline. Cached pages may still work; live auction data will not update.
    </div>
  );
}

export function QueryState({
  isLoading,
  isError,
  error,
  isEmpty,
  emptyTitle,
  emptyDescription,
  onRetry,
  children,
}: {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  onRetry?: () => void;
  children: ReactNode;
}) {
  if (isLoading) return <PageSkeleton />;
  if (isError) return <ErrorState error={error} onRetry={onRetry} />;
  if (isEmpty) return <EmptyState title={emptyTitle ?? "Nothing here yet"} description={emptyDescription} />;
  return <>{children}</>;
}
