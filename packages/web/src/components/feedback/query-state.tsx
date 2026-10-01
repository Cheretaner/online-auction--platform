import { AlertTriangle, Inbox, WifiOff, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getErrorMessage, isApiError } from "@/lib/api/errors";
import { cn } from "@/lib/utils";

export function PageSkeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-3", className)} aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-16 w-full rounded-lg" />
      ))}
    </div>
  );
}

/**
 * "Nothing here" message. `page` sizing is for a whole page or list; `inline`
 * is for an empty panel or tab inside a page.
 */
export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
  size = "page",
  className,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  icon?: LucideIcon;
  size?: "page" | "inline";
  className?: string;
}) {
  const inline = size === "inline";
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-center",
        inline ? "px-4 py-8" : "bg-card/50 px-6 py-14",
        className,
      )}
    >
      <span
        className={cn(
          "grid place-items-center rounded-full bg-muted text-muted-foreground",
          inline ? "mb-1 size-9" : "mb-2 size-12",
        )}
      >
        <Icon className={inline ? "size-4" : "size-5"} aria-hidden />
      </span>
      {inline ? (
        <p className="text-sm font-medium">{title}</p>
      ) : (
        <h2 className="text-xl font-semibold">{title}</h2>
      )}
      {description ? (
        <p className={cn("max-w-md text-muted-foreground", inline ? "text-xs leading-5" : "text-sm leading-6")}>
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  className?: string;
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
    <Alert variant="destructive" className={className}>
      <AlertTriangle aria-hidden />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-3">
        <span>{getErrorMessage(error)}</span>
        {onRetry ? (
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
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
    <div role="status" className="flex items-center gap-2 bg-warning px-4 py-2 text-sm font-medium text-warning-foreground">
      <WifiOff className="size-4 shrink-0" aria-hidden />
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
  emptyAction,
  emptyIcon,
  onRetry,
  children,
}: {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: ReactNode;
  emptyAction?: ReactNode;
  emptyIcon?: LucideIcon;
  onRetry?: () => void;
  children: ReactNode;
}) {
  if (isLoading) return <PageSkeleton />;
  if (isError) return <ErrorState error={error} onRetry={onRetry} />;
  if (isEmpty)
    return (
      <EmptyState
        title={emptyTitle ?? "Nothing here yet"}
        description={emptyDescription}
        action={emptyAction}
        icon={emptyIcon}
      />
    );
  return <>{children}</>;
}
