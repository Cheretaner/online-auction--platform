import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ReasonDialog } from "@/components/feedback/reason-dialog";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuctionDeposits, useReleaseDeposit, useReviewDeposit, useUploadDocument } from "@/features/operations/queries";
import { getErrorMessage } from "@/lib/api/errors";
import type { Auction, DepositRecord } from "@/lib/api/types";
import { downloadDocument } from "@/lib/download";
import { formatDateTime, formatMoney } from "@/lib/format";

const RELEASABLE = new Set(["closed", "awarded", "cancelled"]);

/** Bid security review for one auction: verify or reject what bidders
 * registered, and release instruments once the auction is over. */
export function DepositReview({ auction }: { auction: Auction }) {
  const deposits = useAuctionDeposits(auction.id);
  const review = useReviewDeposit();
  const release = useReleaseDeposit();
  const upload = useUploadDocument();
  const [rejecting, setRejecting] = useState<DepositRecord | null>(null);
  const [releasing, setReleasing] = useState<DepositRecord | null>(null);
  const [releaseReferenceNumber, setReleaseReferenceNumber] = useState("");
  const [releaseEvidence, setReleaseEvidence] = useState<File | null>(null);
  const [releaseError, setReleaseError] = useState<string | null>(null);
  const [submittingRelease, setSubmittingRelease] = useState(false);
  const items = deposits.data?.items ?? [];

  if (deposits.isLoading) return <p className="text-sm text-muted-foreground">Loading deposits…</p>;
  if (deposits.isError) return <p className="text-sm text-destructive">{getErrorMessage(deposits.error)}</p>;
  if (items.length === 0) return <p className="text-sm text-muted-foreground">No deposits registered yet.</p>;

  const verify = (deposit: DepositRecord) =>
    review.mutate(
      { id: deposit.id, body: { decision: "verified" } },
      { onSuccess: () => toast.success("Deposit verified"), onError: (error) => toast.error(getErrorMessage(error)) },
    );

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Instrument</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Submitted</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((deposit) => {
            const short = Number(deposit.amount) < Number(auction.depositAmount);
            return (
              <TableRow key={deposit.id}>
                <TableCell>
                  <p className="font-medium">
                    {deposit.instrumentType.replaceAll("_", " ").toUpperCase()} · {deposit.referenceNumber}
                  </p>
                  <p className="text-xs text-muted-foreground">{deposit.issuingBank}</p>
                </TableCell>
                <TableCell className={short ? "text-destructive" : undefined}>
                  {formatMoney(deposit.amount)}
                  {short ? <span className="block text-xs">below required {formatMoney(auction.depositAmount)}</span> : null}
                </TableCell>
                <TableCell className="text-sm">{formatDateTime(deposit.createdAt)}</TableCell>
                <TableCell>
                  <StatusBadge status={deposit.status} />
                  {deposit.rejectionReason ? <p className="mt-1 text-xs text-muted-foreground">{deposit.rejectionReason}</p> : null}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap justify-end gap-2">
                    {deposit.documentId ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          downloadDocument(deposit.documentId!, `deposit-${deposit.referenceNumber}`).catch((error: unknown) =>
                            toast.error(getErrorMessage(error, "Download failed")),
                          )
                        }
                      >
                        View proof
                      </Button>
                    ) : null}
                    {deposit.releaseDocumentId ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => downloadDocument(deposit.releaseDocumentId!, `release-${deposit.id}`).catch((error: unknown) =>
                          toast.error(getErrorMessage(error, "Download failed")),
                        )}
                      >
                        View release evidence
                      </Button>
                    ) : null}
                    {deposit.status === "pending" ? (
                      <>
                        <Button size="sm" disabled={review.isPending} onClick={() => verify(deposit)}>
                          Verify
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setRejecting(deposit)}>
                          Reject
                        </Button>
                      </>
                    ) : null}
                    {deposit.status === "verified" && RELEASABLE.has(auction.status) && (
                      deposit.bidderId !== auction.winnerId || auction.status === "awarded"
                    ) ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={release.isPending}
                        onClick={() => setReleasing(deposit)}
                      >
                        Release
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
        title="Reject deposit"
        description="The bidder sees this reason and cannot bid until a valid deposit is verified."
        confirmLabel="Reject deposit"
        destructive
        pending={review.isPending}
        onConfirm={(reason) =>
          rejecting &&
          review.mutate(
            { id: rejecting.id, body: { decision: "rejected", rejectionReason: reason } },
            {
              onSuccess: () => {
                toast.success("Deposit rejected");
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
            <DialogTitle>Record manual instrument release</DialogTitle>
            <DialogDescription>
              Record the bank or instrument-return reference and attach its private confirmation before changing status.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="release-reference">Release confirmation reference</Label>
              <Input
                id="release-reference"
                autoComplete="off"
                value={releaseReferenceNumber}
                onChange={(event) => setReleaseReferenceNumber(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="release-evidence">Bank release / returned instrument evidence</Label>
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
            <Button variant="outline" onClick={() => setReleasing(null)}>Keep held</Button>
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
                  toast.success("Release evidence recorded and deposit released");
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
              {submittingRelease ? "Recording…" : "Confirm release"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
