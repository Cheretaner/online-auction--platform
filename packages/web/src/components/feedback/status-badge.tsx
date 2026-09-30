import type { AuctionStatus } from "@auction/shared";
import { Badge } from "@/components/ui/badge";
import { statusLabel } from "@/lib/format";

const variants: Record<AuctionStatus, "default" | "secondary" | "outline" | "destructive" | "success" | "muted"> = {
  draft: "muted",
  pending_review: "secondary",
  scheduled: "outline",
  live: "success",
  closed: "secondary",
  under_review: "secondary",
  awarded: "default",
  cancelled: "destructive",
};

export function StatusBadge({ status }: { status: string }) {
  const variant = (variants as Record<string, typeof variants[AuctionStatus]>)[status] ?? "outline";
  return <Badge variant={variant}>{statusLabel(status)}</Badge>;
}
