import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { VerificationDecision } from "@auction/shared";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { QueryState } from "@/components/feedback/query-state";
import { ReasonDialog } from "@/components/feedback/reason-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  usePendingVerifications,
  useReviewVerification,
  useVerificationDuplicates,
} from "@/features/operations/queries";
import { authApi } from "@/lib/api/auth";
import { getErrorMessage } from "@/lib/api/errors";
import type { VerificationRecord } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";

export default function VerificationReviewPage() {
  const pending = usePendingVerifications();
  const items = pending.data?.items ?? [];
  return (
    <div>
      <PageHeader
        title="Identity review queue"
        description="Check each submission against the applicant's details before approving. Approved bidders can bid on any auction."
      />
      <QueryState
        isLoading={pending.isLoading}
        isError={pending.isError}
        error={pending.error}
        isEmpty={items.length === 0}
        emptyIcon={ShieldCheck}
        emptyTitle="Nothing to review"
        emptyDescription="You're all caught up. New identity submissions appear here."
        onRetry={() => void pending.refetch()}
      >
        <div className="space-y-3">
          {items.map((item) => (
            <ReviewCard key={item.id} record={item} />
          ))}
        </div>
      </QueryState>
    </div>
  );
}

function ReviewCard({ record }: { record: VerificationRecord }) {
  const profile = useQuery({
    queryKey: ["auth", "user", record.userId],
    queryFn: () => authApi.getUser(record.userId),
  });
  const duplicates = useVerificationDuplicates(record.userId);
  const review = useReviewVerification();
  const [dialog, setDialog] = useState<Exclude<VerificationDecision, "approved"> | null>(null);

  const decide = (decision: VerificationDecision, decisionReason?: string) =>
    review.mutate(
      { id: record.id, body: { decision, decisionReason } },
      {
        onSuccess: () => {
          toast.success(decision === "approved" ? "Approved" : "Decision recorded");
          setDialog(null);
        },
        onError: (error) => toast.error(getErrorMessage(error)),
      },
    );

  const user = profile.data;
  return (
    <Card>
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-base font-semibold">{user?.fullName ?? "Loading applicant…"}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
          <p className="text-xs text-muted-foreground">Submitted {formatDateTime(record.createdAt)}</p>
        </div>

        <dl className="grid gap-x-6 gap-y-4 rounded-md bg-muted/50 p-4 text-sm sm:grid-cols-3">
          <Field label="Document" value={record.documentType.replaceAll("_", " ")} />
          <Field label="Document number" value={record.documentNumber} />
          <Field label="Account type" value={user?.accountType ?? "—"} />
          <Field label="National ID on profile" value={user?.nationalId ?? "—"} />
          <Field label="TIN on profile" value={user?.tinNumber ?? "—"} />
          <Field label="Business" value={user?.businessName ?? "—"} />
        </dl>

        {duplicates.data?.hasDuplicates ? (
          <Alert variant="warning">
            <AlertTriangle aria-hidden />
            <AlertTitle>Possible duplicate identity</AlertTitle>
            <AlertDescription>
              {duplicates.data.duplicates.length} other account(s) use the same national ID or TIN. Check before approving.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button disabled={review.isPending} onClick={() => decide("approved")}>
            Approve
          </Button>
          <Button variant="outline" disabled={review.isPending} onClick={() => setDialog("resubmission_required")}>
            Ask to resubmit
          </Button>
          <Button variant="destructive-outline" disabled={review.isPending} onClick={() => setDialog("rejected")}>
            Reject
          </Button>
        </div>
      </CardContent>
      <ReasonDialog
        open={dialog !== null}
        onOpenChange={(open) => !open && setDialog(null)}
        title={dialog === "rejected" ? "Reject verification" : "Ask for resubmission"}
        description="The applicant sees this reason."
        confirmLabel={dialog === "rejected" ? "Reject" : "Send back"}
        destructive={dialog === "rejected"}
        pending={review.isPending}
        onConfirm={(reason) => dialog && decide(dialog, reason)}
      />
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="eyebrow text-muted-foreground">{label}</dt>
      <dd className="mt-1 truncate font-medium capitalize">{value}</dd>
    </div>
  );
}
