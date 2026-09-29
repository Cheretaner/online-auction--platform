import { useState } from "react";
import { toast } from "sonner";
import { ReasonDialog } from "@/components/feedback/reason-dialog";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuctionDeposits, useReleaseDeposit, useReviewDeposit } from "@/features/operations/queries";
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
  const [rejecting, setRejecting] = useState<DepositRecord | null>(null);
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
                    {deposit.status === "verified" && RELEASABLE.has(auction.status) && deposit.bidderId !== auction.winnerId ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={release.isPending}
                        onClick={() =>
                          release.mutate(deposit.id, {
                            onSuccess: () => toast.success("Deposit released"),
                            onError: (error) => toast.error(getErrorMessage(error)),
                          })
                        }
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
    </div>
  );
}
