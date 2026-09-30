import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ReasonDialog } from "@/components/feedback/reason-dialog";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/features/auth/auth-provider";
import { useReviewAnomaly } from "@/features/ai/queries";
import { getErrorMessage } from "@/lib/api/errors";
import type { AnomalyFlagRecord } from "@/lib/api/types";
import { formatDateTime, hasRole } from "@/lib/format";

type Decision = "reviewed" | "dismissed" | "escalated";

const DECISION_COPY: Record<Decision, { title: string; confirm: string; description: string }> = {
  dismissed: {
    title: "Dismiss this flag",
    confirm: "Dismiss",
    description: "The pattern has an innocent explanation. The auction can proceed to award.",
  },
  reviewed: {
    title: "Mark as reviewed",
    confirm: "Mark reviewed",
    description: "You checked the flag and recorded your findings. The auction can proceed to award.",
  },
  escalated: {
    title: "Escalate",
    confirm: "Escalate",
    description: "Refer the flag for further investigation. No automated penalty follows from this.",
  },
};

const SEVERITY_TONE: Record<AnomalyFlagRecord["severity"], string> = {
  high: "bg-destructive/10 text-destructive border-destructive/30",
  medium: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  low: "bg-muted text-muted-foreground",
};

export function AnomalyList({ items, showAuctionLink = true }: { items: AnomalyFlagRecord[]; showAuctionLink?: boolean }) {
  return (
    <div className="space-y-3">
      {items.map((flag) => (
        <AnomalyCard key={flag.id} flag={flag} showAuctionLink={showAuctionLink} />
      ))}
    </div>
  );
}

function AnomalyCard({ flag, showAuctionLink }: { flag: AnomalyFlagRecord; showAuctionLink: boolean }) {
  const { roles } = useAuth();
  const review = useReviewAnomaly();
  const [decision, setDecision] = useState<Decision | null>(null);
  const canReview = hasRole(roles, "compliance_officer", "org_admin", "super_admin");

  return (
    <Card>
      <CardContent className="space-y-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={`capitalize ${SEVERITY_TONE[flag.severity]}`}>
              {flag.severity} · score {Number(flag.score).toFixed(0)}
            </Badge>
            {flag.triggeredRules.map((rule) => (
              <Badge key={rule} variant="secondary" className="font-mono text-xs">
                {rule}
              </Badge>
            ))}
          </div>
          <StatusBadge status={flag.status} />
        </div>
        <p className="text-sm">{flag.explanation ?? "No explanation recorded."}</p>
        <p className="text-xs text-muted-foreground">
          {flag.subjectAccounts.length} account(s) involved · flagged {formatDateTime(flag.createdAt)}
          {showAuctionLink ? (
            <>
              {" · "}
              <Link className="text-primary underline" to={`/app/auctions/${flag.auctionId}`}>
                auction
              </Link>
            </>
          ) : null}
        </p>
        {flag.decisionNote ? (
          <p className="rounded-md bg-muted p-2 text-sm">
            <span className="font-medium">Decision:</span> {flag.decisionNote}
          </p>
        ) : null}
        {canReview && flag.status === "open" ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setDecision("dismissed")}>
              Dismiss
            </Button>
            <Button size="sm" variant="outline" onClick={() => setDecision("reviewed")}>
              Mark reviewed
            </Button>
            <Button size="sm" variant="destructive" onClick={() => setDecision("escalated")}>
              Escalate
            </Button>
          </div>
        ) : null}
      </CardContent>
      {decision ? (
        <ReasonDialog
          open
          onOpenChange={(open) => !open && setDecision(null)}
          title={DECISION_COPY[decision].title}
          description={DECISION_COPY[decision].description}
          label="Decision note"
          confirmLabel={DECISION_COPY[decision].confirm}
          destructive={decision === "escalated"}
          pending={review.isPending}
          onConfirm={(note) =>
            review.mutate(
              { id: flag.id, body: { status: decision, decisionNote: note } },
              {
                onSuccess: () => {
                  toast.success("Decision recorded");
                  setDecision(null);
                },
                onError: (error) => toast.error(getErrorMessage(error)),
              },
            )
          }
        />
      ) : null}
    </Card>
  );
}
