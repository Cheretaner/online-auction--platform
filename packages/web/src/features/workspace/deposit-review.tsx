import { useState } from "react";
import { toast } from "sonner";
import { Wallet } from "lucide-react";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/feedback/query-state";
import { ReasonDialog } from "@/components/feedback/reason-dialog";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuctionDeposits, useReleaseDeposit, useReviewDeposit } from "@/features/operations/queries";
import { getErrorMessage } from "@/lib/api/errors";
import type { Auction, DepositRecord } from "@/lib/api/types";
import { downloadDocument } from "@/lib/download";
import { enumLabel, formatDateTime, formatMoney } from "@/lib/format";
import { useT } from "@/i18n/context";

const RELEASABLE = new Set(["closed", "awarded", "cancelled"]);

/** Bid security review for one auction: verify or reject what bidders
 * registered, and release instruments once the auction is over. */
export function DepositReview({ auction }: { auction: Auction }) {
  const deposits = useAuctionDeposits(auction.id);
  const review = useReviewDeposit();
  const release = useReleaseDeposit();
  const [rejecting, setRejecting] = useState<DepositRecord | null>(null);
  const t = useT("workspace");
  const tc = useT("common");
  const items = deposits.data?.items ?? [];

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
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          downloadDocument(deposit.documentId!, `deposit-${deposit.referenceNumber}`).catch((error: unknown) =>
                            toast.error(getErrorMessage(error, tc("downloadFailed"))),
                          )
                        }
                      >
                        {t("deposits.viewProof")}
                      </Button>
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
                    {deposit.status === "verified" && RELEASABLE.has(auction.status) && deposit.bidderId !== auction.winnerId ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={release.isPending}
                        onClick={() =>
                          release.mutate(deposit.id, {
                            onSuccess: () => toast.success(t("deposits.released")),
                            onError: (error) => toast.error(getErrorMessage(error)),
                          })
                        }
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
    </div>
  );
}
