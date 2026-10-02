import { Link } from "react-router-dom";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { QueryState } from "@/components/feedback/query-state";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { useMyDeposits } from "@/features/operations/queries";
import { enumLabel, formatDateTime, formatMoney } from "@/lib/format";
import { useT } from "@/i18n/context";

export default function DepositsPage() {
  const deposits = useMyDeposits();
  const items = deposits.data?.items ?? [];
  const t = useT("account");
  return (
    <div>
      <PageHeader
        title={t("deposits.title")}
        description={t("deposits.description")}
      />
      <QueryState
        isLoading={deposits.isLoading}
        isError={deposits.isError}
        error={deposits.error}
        isEmpty={items.length === 0}
        emptyIcon={Wallet}
        emptyTitle={t("deposits.emptyTitle")}
        emptyDescription={t("deposits.emptyBody")}
        emptyAction={
          <Button asChild variant="outline">
            <Link to="/auctions?status=live">{t("deposits.browseLive")}</Link>
          </Button>
        }
        onRetry={() => void deposits.refetch()}
      >
        <div className="space-y-3">
          {items.map((deposit) => (
            <Card key={deposit.id}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
                <div className="min-w-0 space-y-1">
                  <p className="text-base font-semibold tabular-nums">
                    {formatMoney(deposit.amount)}
                    <span className="eyebrow ml-2 align-middle text-muted-foreground">
                      {enumLabel(deposit.instrumentType)}
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t("deposits.reference", { bank: deposit.issuingBank, reference: deposit.referenceNumber })}
                  </p>
                  <p className="text-xs text-muted-foreground">{t("deposits.submittedOn", { date: formatDateTime(deposit.createdAt) })}</p>
                  {deposit.status === "rejected" && deposit.rejectionReason ? (
                    <p className="text-sm text-destructive">{t("deposits.rejected", { reason: deposit.rejectionReason })}</p>
                  ) : null}
                  <Link className="inline-block pt-1 text-sm font-medium text-primary underline-offset-4 hover:underline" to={`/auctions/${deposit.auctionId}`}>
                    {t("deposits.viewAuction")}
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
