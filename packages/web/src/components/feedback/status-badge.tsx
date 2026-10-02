import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { statusLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * One meaning per colour, across every status domain in the app
 * (auctions, deposits, identity checks, disputes, anomaly flags, compliance):
 * success = done/accepted, warning = waiting on someone, destructive = refused/failed,
 * info = in progress, default = active/open now, muted = inactive or finished.
 */
const TONES: Record<string, BadgeVariant> = {
  // auctions
  draft: "muted",
  pending_review: "warning",
  scheduled: "info",
  live: "default",
  closed: "muted",
  under_review: "warning",
  awarded: "success",
  unsold: "muted",
  cancelled: "destructive",
  // deposits, identity, compliance
  pending: "warning",
  verified: "success",
  passed: "success",
  approved: "success",
  released: "muted",
  rejected: "destructive",
  failed: "destructive",
  unverified: "muted",
  resubmission_required: "warning",
  // disputes, anomaly flags
  open: "warning",
  resolved: "success",
  reviewed: "success",
  dismissed: "muted",
  escalated: "destructive",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const variant = TONES[status] ?? "outline";
  return (
    <Badge variant={variant} className={cn("capitalize", className)}>
      <span
        className={cn("size-1.5 rounded-full bg-current", status === "live" && "animate-pulse")}
        aria-hidden
      />
      {statusLabel(status)}
    </Badge>
  );
}
