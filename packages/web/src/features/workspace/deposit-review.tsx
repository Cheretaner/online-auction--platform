import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Wallet } from "lucide-react";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/feedback/query-state";
import { ReasonDialog } from "@/components/feedback/reason-dialog";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  useAuctionDeposits,
  useDocumentOcr,
  useReleaseDeposit,
  useReviewDeposit,
  useReviewDepositReferenceOcr,
  useStartDocumentOcr,
  usePlatformCapabilities,
  useUploadDocument,
} from "@/features/operations/queries";
import { getErrorMessage } from "@/lib/api/errors";
import type { Auction, DepositRecord } from "@/lib/api/types";
import { downloadDocument } from "@/lib/download";
import { DocumentPreviewButton } from "@/features/documents/document-preview-button";
import { enumLabel, formatDateTime, formatMoney } from "@/lib/format";
import { useT } from "@/i18n/context";
import { Alert, AlertTitle } from "@/components/ui/alert";

const RELEASABLE = new Set(["closed", "awarded", "cancelled"]);

function DepositReferenceOcr({ deposit }: { deposit: DepositRecord }) {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState<{ candidate: string; matches: boolean } | null>(null);
  const t = useT("workspace");
  const documentId = deposit.documentId ?? "";
  const extraction = useDocumentOcr(documentId, open);
  const start = useStartDocumentOcr(documentId);
  const reviewCandidate = useReviewDepositReferenceOcr(documentId);
  if (!documentId) return null;

  return (
    <div className="space-y-2">
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setOpen(true);
          start.mutate(undefined, {
            onError: (error) => toast.error(getErrorMessage(error, t("deposits.ocrFailed"))),
          });
        }}
        loading={start.isPending}
      >{t("deposits.readReference")}</Button>
      {open && extraction.data?.status === "processing" ? (
        <p role="status" className="text-xs text-muted-foreground">{t("deposits.ocrProcessing")}</p>
      ) : null}
      {open && extraction.data?.status === "failed" ? (
        <p role="alert" className="text-xs text-destructive">
          {extraction.data.errorMessage ?? getErrorMessage(extraction.error, t("deposits.ocrFailed"))}
        </p>
      ) : null}
      {open && extraction.data?.status === "completed" ? (
        <div className="space-y-2 rounded-md border bg-muted/30 p-2">
          <p className="text-xs text-muted-foreground">{t("deposits.ocrVerifyNotice")}</p>
          {extraction.data.referenceCandidates.length ? (
            <ul className="space-y-1">
              {extraction.data.referenceCandidates.map((candidate) => (
                <li key={candidate} className="flex flex-wrap items-center gap-2 text-xs">
                  <code className="rounded bg-background px-1.5 py-1">{candidate}</code>
                  <Button size="sm" variant="ghost" loading={reviewCandidate.isPending}
                    onClick={() => reviewCandidate.mutate(candidate, {
                      onSuccess: ({ item }) => setChecked({ candidate: item.candidate, matches: item.matchesSubmittedReference }),
                      onError: (error) => toast.error(getErrorMessage(error, t("deposits.ocrFailed"))),
                    })}
                  >{t("deposits.checkSuggestion")}</Button>
                </li>
              ))}
            </ul>
          ) : <p className="text-xs text-muted-foreground">{t("deposits.noOcrReference")}</p>}
          {checked ? (
            <p role="status" className="text-xs font-medium">
              {checked.candidate}: {checked.matches ? t("deposits.referenceMatches") : t("deposits.referenceDiffers")}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Bid security review for one auction: verify or reject what bidders
 * registered, and release instruments once the auction is over. */
export function DepositReview({ auction, focusedDepositId }: { auction: Auction; focusedDepositId?: string }) {
  const deposits = useAuctionDeposits(auction.id);
  const review = useReviewDeposit();
  const release = useReleaseDeposit();
  const upload = useUploadDocument();
  const uploads = usePlatformCapabilities();
  const [rejecting, setRejecting] = useState<DepositRecord | null>(null);
  const [releasing, setReleasing] = useState<DepositRecord | null>(null);
  const [releaseReferenceNumber, setReleaseReferenceNumber] = useState("");
  const [releaseEvidence, setReleaseEvidence] = useState<File | null>(null);
  const [releaseError, setReleaseError] = useState<string | null>(null);
  const [submittingRelease, setSubmittingRelease] = useState(false);
  const items = (deposits.data?.items ?? []).filter(
    (deposit) => !focusedDepositId || deposit.id === focusedDepositId,
  );
  const hasReleasableDeposit = items.some(
    (deposit) =>
      deposit.status === "verified" &&
      RELEASABLE.has(auction.status) &&
      (deposit.bidderId !== auction.winnerId || auction.status === "awarded"),
  );
  const t = useT("workspace");
  const tc = useT("common");

  if (deposits.isLoading) return <PageSkeleton rows={2} />;
  if (deposits.isError) return <ErrorState error={deposits.error} onRetry={() => void deposits.refetch()} />;
  if (items.length === 0)
    return (
      <EmptyState
        size="inline"
        icon={Wallet}
        title={t("deposits.emptyTitle")}
        description={t("deposits.emptyBody")}
      />
    );

  const verify = (deposit: DepositRecord) =>
    review.mutate(
      { id: deposit.id, body: { decision: "verified" } },
      { onSuccess: () => toast.success(t("deposits.verified")), onError: (error) => toast.error(getErrorMessage(error)) },
    );

  return (
    <div>
      {hasReleasableDeposit && uploads.isPending ? (
        <p className="mb-4 text-sm text-muted-foreground" role="status">{tc("checkingDocumentUploads")}</p>
      ) : hasReleasableDeposit && (!uploads.isSuccess || !uploads.data.documentUploadsEnabled) ? (
        <Alert variant="warning" className="mb-4">
          <AlertTitle>
            {uploads.isError ? tc("documentUploadsStatusUnknown") : tc("documentUploadsUnavailable")}
          </AlertTitle>
        </Alert>
      ) : null}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("deposits.instrument")}</TableHead>
            <TableHead>{t("deposits.amount")}</TableHead>
            <TableHead>{t("deposits.submitted")}</TableHead>
            <TableHead>{t("deposits.status")}</TableHead>
            <TableHead className="text-right">{t("deposits.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((deposit) => {
            const short = Number(deposit.amount) < Number(auction.depositAmount);
            return (
              <TableRow key={deposit.id}>
                <TableCell>
                  <p className="font-medium">
                    {enumLabel(deposit.instrumentType)} · {deposit.referenceNumber}
                  </p>
                  <p className="text-xs text-muted-foreground">{deposit.issuingBank}</p>
                </TableCell>
                <TableCell className={short ? "text-destructive tabular-nums" : "tabular-nums"}>
                  {formatMoney(deposit.amount)}
                  {short ? <span className="block text-xs">{t("deposits.belowRequired", { amount: formatMoney(auction.depositAmount) })}</span> : null}
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(deposit.createdAt)}</TableCell>
                <TableCell>
                  <StatusBadge status={deposit.status} />
                  {deposit.rejectionReason ? <p className="mt-1 text-xs text-muted-foreground">{deposit.rejectionReason}</p> : null}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap justify-end gap-2">
                    {deposit.documentId ? (
                      <>
                        <DepositReferenceOcr deposit={deposit} />
                        <DocumentPreviewButton documentId={deposit.documentId} fileName={`deposit-${deposit.id}`} allowUnknown />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => downloadDocument(deposit.documentId!, `deposit-${deposit.referenceNumber}`).catch((error: unknown) =>
                            toast.error(getErrorMessage(error, tc("downloadFailed"))),
                          )}
                        >
                          {t("deposits.viewProof")}
                        </Button>
                      </>
                    ) : null}
                    {deposit.releaseDocumentId ? (
                      <>
                        <DocumentPreviewButton documentId={deposit.releaseDocumentId} fileName={`release-${deposit.id}`} allowUnknown />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => downloadDocument(deposit.releaseDocumentId!, `release-${deposit.id}`).catch((error: unknown) =>
                            toast.error(getErrorMessage(error, tc("downloadFailed"))),
                          )}
                        >
                          {t("deposits.viewReleaseEvidence")}
                        </Button>
                      </>
                    ) : null}
                    {deposit.status === "pending" ? (
                      <>
                        <Button size="sm" disabled={review.isPending} onClick={() => verify(deposit)}>
                          {t("deposits.verify")}
                        </Button>
                        <Button size="sm" variant="destructive-outline" onClick={() => setRejecting(deposit)}>
                          {t("deposits.reject")}
                        </Button>
                      </>
                    ) : null}
                    {uploads.isSuccess && uploads.data.documentUploadsEnabled && deposit.status === "verified" && RELEASABLE.has(auction.status) && (
                      deposit.bidderId !== auction.winnerId || auction.status === "awarded"
                    ) ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={release.isPending}
                        onClick={() => setReleasing(deposit)}
                      >
                        {t("deposits.release")}
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <ReasonDialog
        open={rejecting !== null}
        onOpenChange={(open) => !open && setRejecting(null)}
        title={t("deposits.rejectTitle")}
        description={t("deposits.rejectDescription")}
        confirmLabel={t("deposits.rejectTitle")}
        destructive
        pending={review.isPending}
        onConfirm={(reason) =>
          rejecting &&
          review.mutate(
            { id: rejecting.id, body: { decision: "rejected", rejectionReason: reason } },
            {
              onSuccess: () => {
                toast.success(t("deposits.rejected"));
                setRejecting(null);
              },
              onError: (error) => toast.error(getErrorMessage(error)),
            },
          )
        }
      />
      <Dialog
        open={releasing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setReleasing(null);
            setReleaseReferenceNumber("");
            setReleaseEvidence(null);
            setReleaseError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deposits.releaseTitle")}</DialogTitle>
            <DialogDescription>{t("deposits.releaseDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="release-reference">{t("deposits.releaseReference")}</Label>
              <Input
                id="release-reference"
                autoComplete="off"
                value={releaseReferenceNumber}
                onChange={(event) => setReleaseReferenceNumber(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="release-evidence">{t("deposits.releaseEvidence")}</Label>
              <Input
                id="release-evidence"
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                onChange={(event) => setReleaseEvidence(event.target.files?.[0] ?? null)}
              />
            </div>
            {releaseError ? <p className="text-sm text-destructive" role="alert">{releaseError}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReleasing(null)}>{t("deposits.keepHeld")}</Button>
            <Button
              disabled={submittingRelease || !releaseReferenceNumber.trim() || !releaseEvidence}
              onClick={async () => {
                if (!releasing || !releaseEvidence) return;
                setSubmittingRelease(true);
                setReleaseError(null);
                try {
                  const form = new FormData();
                  form.set("file", releaseEvidence);
                  form.set("docType", "deposit_release_evidence");
                  form.set("auctionId", auction.id);
                  form.set("isPrivate", "true");
                  const document = await upload.mutateAsync(form);
                  await release.mutateAsync({
                    id: releasing.id,
                    body: { releaseReferenceNumber, releaseDocumentId: document.id },
                  });
                  toast.success(t("deposits.releaseRecorded"));
                  setReleasing(null);
                  setReleaseReferenceNumber("");
                  setReleaseEvidence(null);
                } catch (error) {
                  setReleaseError(getErrorMessage(error));
                } finally {
                  setSubmittingRelease(false);
                }
              }}
            >
              {submittingRelease ? t("deposits.recording") : t("deposits.confirmRelease")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
