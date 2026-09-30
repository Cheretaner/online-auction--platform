import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/features/auth/auth-provider";
import { useAssignDispute, useResolveDispute } from "@/features/operations/queries";
import { getErrorMessage } from "@/lib/api/errors";
import type { DisputeRecord } from "@/lib/api/types";
import { formatDateTime, hasRole } from "@/lib/format";

/** Disputes with the actions the viewer is allowed to take. Reviewers can
 * take an open dispute and resolve one assigned to them; the API refuses
 * anything outside the reviewer's organization. */
export function DisputeList({ items, showAuctionLink = true }: { items: DisputeRecord[]; showAuctionLink?: boolean }) {
  return (
    <div className="space-y-3">
      {items.map((dispute) => (
        <DisputeCard key={dispute.id} dispute={dispute} showAuctionLink={showAuctionLink} />
      ))}
    </div>
  );
}

function DisputeCard({ dispute, showAuctionLink }: { dispute: DisputeRecord; showAuctionLink: boolean }) {
  const { session, roles } = useAuth();
  const assign = useAssignDispute();
  const [resolving, setResolving] = useState(false);
  const me = session?.user.id;
  const reviewer = hasRole(roles, "compliance_officer", "org_admin", "auction_officer", "super_admin");
  const mine = dispute.raisedBy === me;

  return (
    <Card>
      <CardContent className="space-y-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-sm">{dispute.reason}</p>
            <p className="text-xs text-muted-foreground">
              Raised {formatDateTime(dispute.createdAt)}
              {mine ? " by you" : ""}
              {dispute.assignedReviewer ? (dispute.assignedReviewer === me ? " · assigned to you" : " · assigned") : ""}
            </p>
            {showAuctionLink ? (
              <Link className="text-sm text-primary underline" to={`/auctions/${dispute.auctionId}`}>
                View auction
              </Link>
            ) : null}
          </div>
          <StatusBadge status={dispute.status} />
        </div>

        {dispute.decision ? (
          <div className="rounded-md bg-muted p-3 text-sm">
            <p className="font-medium">{dispute.decision}</p>
            {dispute.decisionReason ? <p className="mt-1 text-muted-foreground">{dispute.decisionReason}</p> : null}
          </div>
        ) : null}

        {reviewer && !mine ? (
          <div className="flex flex-wrap gap-2">
            {dispute.status === "open" && me ? (
              <Button
                size="sm"
                disabled={assign.isPending}
                onClick={() =>
                  assign.mutate(
                    { id: dispute.id, body: { reviewerId: me } },
                    {
                      onSuccess: () => toast.success("Assigned to you"),
                      onError: (error) => toast.error(getErrorMessage(error)),
                    },
                  )
                }
              >
                Take this dispute
              </Button>
            ) : null}
            {dispute.status === "under_review" ? (
              <Button size="sm" variant="outline" onClick={() => setResolving(true)}>
                Record decision
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardContent>
      <ResolveDialog dispute={dispute} open={resolving} onOpenChange={setResolving} />
    </Card>
  );
}

function ResolveDialog({
  dispute,
  open,
  onOpenChange,
}: {
  dispute: DisputeRecord;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const resolve = useResolveDispute();
  const id = useId();
  const [decision, setDecision] = useState("");
  const [reason, setReason] = useState("");
  const valid = decision.trim().length >= 3 && reason.trim().length >= 12;

  const submit = (status: "resolved" | "rejected") =>
    resolve.mutate(
      { id: dispute.id, body: { status, decision: decision.trim(), decisionReason: reason.trim() } },
      {
        onSuccess: () => {
          toast.success(status === "resolved" ? "Dispute resolved" : "Dispute rejected");
          onOpenChange(false);
        },
        onError: (error) => toast.error(getErrorMessage(error)),
      },
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record a decision</DialogTitle>
          <DialogDescription>The bidder is notified, and the decision goes into the audit trail.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-decision`}>Decision</Label>
            <Input
              id={`${id}-decision`}
              placeholder="e.g. Closing time extension upheld"
              value={decision}
              onChange={(event) => setDecision(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-reason`}>Reasoning (at least 12 characters)</Label>
            <Textarea id={`${id}-reason`} rows={4} value={reason} onChange={(event) => setReason(event.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={!valid || resolve.isPending} onClick={() => submit("rejected")}>
            Reject dispute
          </Button>
          <Button disabled={!valid || resolve.isPending} onClick={() => submit("resolved")}>
            Uphold and resolve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
