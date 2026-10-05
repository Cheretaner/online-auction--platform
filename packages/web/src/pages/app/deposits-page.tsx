import { Link } from "react-router-dom";
import { useState } from "react";
import { FileText, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, QueryState } from "@/components/feedback/query-state";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DocumentPreviewButton } from "@/features/documents/document-preview-button";
import { useMyDeposits } from "@/features/operations/queries";
import { enumLabel, formatDateTime, formatMoney } from "@/lib/format";
import { useT } from "@/i18n/context";
import type { DepositRecord } from "@/lib/api/types";
import { downloadDocument } from "@/lib/download";
import { getErrorMessage } from "@/lib/api/errors";
import { toast } from "sonner";

export default function DepositsPage() {
  const deposits = useMyDeposits();
  const items = deposits.data?.items ?? [];
  const [statusFilter, setStatusFilter] = useState("all");
  const t = useT("account");
  const filteredItems = statusFilter === "all" ? items : items.filter((deposit) => deposit.status === statusFilter);
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
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
              {t("deposits.count", { count: filteredItems.length })}
            </p>
            <div className="flex items-center gap-2">
              <label htmlFor="deposit-status-filter" className="text-sm font-medium">{t("deposits.filterStatus")}</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="deposit-status-filter" className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("deposits.allStatuses")}</SelectItem>
                  {(["pending", "verified", "rejected", "released"] as const).map((status) => (
                    <SelectItem key={status} value={status}>{t(`deposits.status.${status}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {filteredItems.length ? (
            <div className="space-y-3">
              {filteredItems.map((deposit) => <DepositCard key={deposit.id} deposit={deposit} />)}
            </div>
          ) : (
            <EmptyState
              size="inline"
              icon={Wallet}
              title={t("deposits.noStatusMatches")}
              description={t("deposits.clearFilterHint")}
              action={<Button variant="outline" onClick={() => setStatusFilter("all")}>{t("deposits.clearFilter")}</Button>}
            />
          )}
        </div>
      </QueryState>
    </div>
  );
}

function DepositCard({ deposit }: { deposit: DepositRecord }) {
  const [downloading, setDownloading] = useState(false);
  const t = useT("account");
  const tc = useT("common");
  const documentId = deposit.documentId;
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
        <div className="min-w-0 space-y-1">
          <p className="text-base font-semibold tabular-nums">
            {formatMoney(deposit.amount)}
            <span className="eyebrow ml-2 align-middle text-muted-foreground">{enumLabel(deposit.instrumentType)}</span>
          </p>
          <p className="break-words text-sm text-muted-foreground">
            {t("deposits.reference", { bank: deposit.issuingBank, reference: deposit.referenceNumber })}
          </p>
          <p className="text-xs text-muted-foreground">{t("deposits.submittedOn", { date: formatDateTime(deposit.createdAt) })}</p>
          {deposit.verifiedAt ? <p className="text-xs text-muted-foreground">{t("deposits.reviewedOn", { date: formatDateTime(deposit.verifiedAt) })}</p> : null}
          {deposit.status === "rejected" && deposit.rejectionReason ? (
            <p className="text-sm text-destructive">{t("deposits.rejected", { reason: deposit.rejectionReason })}</p>
          ) : null}
          <Link className="inline-block pt-1 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" to={`/auctions/${deposit.auctionId}`}>
            {t("deposits.viewAuction")}
          </Link>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <StatusBadge status={deposit.status} />
          {deposit.documentId ? (
            <div className="flex flex-wrap items-center gap-2" aria-label={t("deposits.evidence")}>
              <DocumentPreviewButton documentId={deposit.documentId} fileName={`deposit-${deposit.referenceNumber}`} allowUnknown />
              <Button
                type="button"
                size="sm"
                variant="outline"
                loading={downloading}
                disabled={downloading}
                onClick={() => {
                  setDownloading(true);
                  if (!documentId) return;
                  downloadDocument(documentId, `deposit-${deposit.referenceNumber}`)
                    .catch((error: unknown) => toast.error(getErrorMessage(error, tc("downloadFailed"))))
                    .finally(() => setDownloading(false));
                }}
              >
                {!downloading ? <FileText aria-hidden /> : null}
                {downloading ? tc("downloading") : t("deposits.downloadEvidence")}
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{t("deposits.noEvidence")}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
