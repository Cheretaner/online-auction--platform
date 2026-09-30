import { Link } from "react-router-dom";
import { PageHeader } from "@/components/layout/page-header";
import { QueryState } from "@/components/feedback/query-state";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { useMyDeposits } from "@/features/operations/queries";
import { formatDateTime, formatMoney } from "@/lib/format";

export default function DepositsPage() {
  const deposits = useMyDeposits();
  const items = deposits.data?.items ?? [];
  return (
    <div>
      <PageHeader
        title="Bid security deposits"
        description="Deposits you registered. Submit a new one from the auction you want to bid on."
      />
      <QueryState
        isLoading={deposits.isLoading}
        isError={deposits.isError}
        error={deposits.error}
        isEmpty={items.length === 0}
        emptyTitle="No deposits yet"
        emptyDescription="Open an auction that requires bid security and submit your CPO or guarantee there."
        onRetry={() => void deposits.refetch()}
      >
        <div className="space-y-3">
          {items.map((deposit) => (
            <Card key={deposit.id}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
                <div className="min-w-0 space-y-1">
                  <p className="font-medium">
                    {formatMoney(deposit.amount)} · {deposit.instrumentType.replaceAll("_", " ").toUpperCase()}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {deposit.issuingBank} · Ref {deposit.referenceNumber}
                  </p>
                  <p className="text-xs text-muted-foreground">Submitted {formatDateTime(deposit.createdAt)}</p>
                  {deposit.status === "rejected" && deposit.rejectionReason ? (
                    <p className="text-sm text-destructive">Rejected: {deposit.rejectionReason}</p>
                  ) : null}
                  <Link className="text-sm text-primary underline" to={`/auctions/${deposit.auctionId}`}>
                    View auction
                  </Link>
                </div>
                <StatusBadge status={deposit.status} />
              </CardContent>
            </Card>
          ))}
        </div>
      </QueryState>
    </div>
  );
}
