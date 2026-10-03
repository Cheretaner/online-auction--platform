import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ReasonDialog } from "@/components/feedback/reason-dialog";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/features/auth/auth-provider";
import { useReviewAnomaly } from "@/features/ai/queries";
import { getErrorMessage } from "@/lib/api/errors";
import type { AnomalyFlagRecord } from "@/lib/api/types";
import { formatDateTime, hasRole, statusLabel } from "@/lib/format";
import { useT } from "@/i18n/context";

type Decision = "reviewed" | "dismissed" | "escalated";

/** Dictionary keys (tools.flag.*) for each decision's dialog. */
const DECISION_COPY = {
  dismissed: { title: "dismissTitle", confirm: "dismiss", description: "dismissDescription" },
  reviewed: { title: "reviewTitle", confirm: "review", description: "reviewDescription" },
  escalated: { title: "escalate", confirm: "escalate", description: "escalateDescription" },
} as const;

const SEVERITY_TONE: Record<AnomalyFlagRecord["severity"], BadgeVariant> = {
  high: "destructive",
  medium: "warning",
  low: "muted",
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
  const t = useT("tools");

  return (
    <Card>
      <CardContent className="space-y-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={SEVERITY_TONE[flag.severity]}>
              {t("flag.score", { severity: statusLabel(flag.severity), score: Number(flag.score).toFixed(0) })}
            </Badge>
            {flag.triggeredRules.map((rule) => (
              <Badge key={rule} variant="secondary" className="font-mono">
                {rule}
              </Badge>
            ))}
          </div>
          <StatusBadge status={flag.status} />
        </div>
        <p className="text-sm leading-6">{flag.explanation ?? t("flag.noExplanation")}</p>
        <p className="text-xs text-muted-foreground">
          {t("flag.meta", { count: flag.subjectAccounts.length, date: formatDateTime(flag.createdAt) })}
          {showAuctionLink ? (
            <>
              {" · "}
              <Link className="font-medium text-primary underline-offset-4 hover:underline" to={`/app/auctions/${flag.auctionId}`}>
                {t("flag.viewAuction")}
              </Link>
            </>
          ) : null}
        </p>
        {flag.decisionNote ? (
          <p className="rounded-md bg-muted p-3 text-sm">
            <span className="font-medium">{t("flag.decision")}</span> {flag.decisionNote}
          </p>
        ) : null}
        {flag.relatedHistory?.length ? (
          <div className="space-y-2 rounded-md border p-3">
            <h4 className="text-sm font-semibold">{t("flag.relatedHistory")}</h4>
            <ul className="space-y-2">
              {flag.relatedHistory.map((entry) => (
                <li key={entry.flagId} className="text-sm">
                  <Link className="font-medium text-primary underline-offset-4 hover:underline" to={`/app/ai?flagId=${encodeURIComponent(entry.flagId)}`}>
                    {entry.auctionTitle}
                  </Link>
                  <span className="text-muted-foreground"> — {statusLabel(entry.severity)} · {statusLabel(entry.status)} · {formatDateTime(entry.createdAt)}</span>
                  {entry.decisionNote ? <p className="mt-1 text-muted-foreground">{t("flag.pastDecision")} {entry.decisionNote}</p> : null}
                  <p className="mt-1 text-muted-foreground">{t("flag.pastOutcome", { status: statusLabel(entry.auctionStatus), amount: entry.awardAmount ? `${entry.awardAmount} ETB` : t("flag.noAwardAmount") })}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {canReview && flag.status === "open" ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setDecision("dismissed")}>
              {t("flag.dismiss")}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setDecision("reviewed")}>
              {t("flag.review")}
            </Button>
            <Button size="sm" variant="destructive-outline" onClick={() => setDecision("escalated")}>
              {t("flag.escalate")}
            </Button>
          </div>
        ) : null}
      </CardContent>
      {decision ? (
        <ReasonDialog
          open
          onOpenChange={(open) => !open && setDecision(null)}
          title={t(`flag.${DECISION_COPY[decision].title}`)}
          description={t(`flag.${DECISION_COPY[decision].description}`)}
          label={t("flag.note")}
          confirmLabel={t(`flag.${DECISION_COPY[decision].confirm}`)}
          destructive={decision === "escalated"}
          pending={review.isPending}
          onConfirm={(note) =>
            review.mutate(
              { id: flag.id, body: { status: decision, decisionNote: note } },
              {
                onSuccess: () => {
                  toast.success(t("flag.recorded"));
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
