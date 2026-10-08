import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import type { VerificationDecision } from "@auction/shared";
import { AlertTriangle, Download, ShieldCheck } from "lucide-react";
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
import { enumLabel, formatDateTime } from "@/lib/format";
import { downloadDocument } from "@/lib/download";
import { DocumentPreviewButton } from "@/features/documents/document-preview-button";
import { useT } from "@/i18n/context";

export default function VerificationReviewPage() {
  const [searchParams] = useSearchParams();
  const pending = usePendingVerifications();
  const requestedId = searchParams.get("recordId");
  const items = (pending.data?.items ?? []).filter(
    (item) => !requestedId || item.id === requestedId,
  );
  const t = useT("account");
  return (
    <div>
      <PageHeader
        title={t("review.title")}
        description={t("review.description")}
      />
      <QueryState
        isLoading={pending.isLoading}
        isError={pending.isError}
        error={pending.error}
        isEmpty={items.length === 0}
        emptyIcon={ShieldCheck}
        emptyTitle={t("review.emptyTitle")}
        emptyDescription={t("review.emptyBody")}
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
  const t = useT("account");
  const [dialog, setDialog] = useState<Exclude<VerificationDecision, "approved"> | null>(null);

  const decide = (decision: VerificationDecision, decisionReason?: string) =>
    review.mutate(
      { id: record.id, body: { decision, decisionReason } },
      {
        onSuccess: () => {
          toast.success(decision === "approved" ? t("review.approvedToast") : t("review.decisionRecorded"));
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
            <p className="text-base font-semibold">{user?.fullName ?? t("review.loadingApplicant")}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
          <p className="text-xs text-muted-foreground">{t("review.submittedOn", { date: formatDateTime(record.createdAt) })}</p>
        </div>

        <dl className="grid gap-x-6 gap-y-4 rounded-md bg-muted/50 p-4 text-sm sm:grid-cols-3">
          <Field label={t("review.document")} value={enumLabel(record.documentType)} />
          <Field label={t("review.documentNumber")} value={record.documentNumber} />
          <Field label={t("review.accountType")} value={user?.accountType ? enumLabel(user.accountType) : "—"} />
          <Field label={t("review.business")} value={user?.businessName ?? "—"} />
        </dl>

        {record.documentId ? (
          <div className="flex flex-wrap gap-2">
            <DocumentPreviewButton documentId={record.documentId} fileName={`verification-${record.id}`} allowUnknown />
            <Button
              variant="outline"
              size="sm"
              aria-label={t("review.downloadEvidence")}
              onClick={() => void downloadDocument(record.documentId!, `verification-${record.id}`).catch((error: unknown) => toast.error(getErrorMessage(error)))}
            >
              <Download className="size-4" aria-hidden />
              {t("review.viewEvidence")}
            </Button>
          </div>
        ) : null}

        {duplicates.data?.hasDuplicates ? (
          <Alert variant="warning">
            <AlertTriangle aria-hidden />
            <AlertTitle>{t("review.duplicateTitle")}</AlertTitle>
            <AlertDescription>{t("review.duplicateBody", { count: duplicates.data.duplicates.length })}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button disabled={review.isPending} onClick={() => decide("approved")}>
            {t("review.approve")}
          </Button>
          <Button variant="outline" disabled={review.isPending} onClick={() => setDialog("resubmission_required")}>
            {t("review.resubmit")}
          </Button>
          <Button variant="destructive-outline" disabled={review.isPending} onClick={() => setDialog("rejected")}>
            {t("review.reject")}
          </Button>
        </div>
      </CardContent>
      <ReasonDialog
        open={dialog !== null}
        onOpenChange={(open) => !open && setDialog(null)}
        title={dialog === "rejected" ? t("review.rejectTitle") : t("review.resubmitTitle")}
        description={t("review.applicantSees")}
        confirmLabel={dialog === "rejected" ? t("review.reject") : t("review.sendBack")}
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
