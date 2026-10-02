import { useState } from "react";
import { Link } from "react-router-dom";
import { REPORT_TYPE } from "@auction/shared";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { ExternalLink, FileText } from "lucide-react";
import { EmptyState, PageSkeleton } from "@/components/feedback/query-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFinancialReconciliation, useGenerateReport, usePublishReport, useReports } from "@/features/operations/queries";
import { getErrorMessage } from "@/lib/api/errors";
import { enumLabel, formatDateTime, formatMoney, statusLabel } from "@/lib/format";
import { useT } from "@/i18n/context";

type ReportType = (typeof REPORT_TYPE)[number];

export function ReportsPanel({ auctionId, canPublish }: { auctionId: string; canPublish: boolean }) {
  const t = useT("workspace");
  const tc = useT("common");
  const reports = useReports(auctionId);
  const generate = useGenerateReport();
  const publish = usePublishReport();
  const reconciliation = useFinancialReconciliation(auctionId);
  const [type, setType] = useState<ReportType>("auction_summary");
  const items = reports.data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <Select value={type} onValueChange={(value) => setType(value as ReportType)}>
          <SelectTrigger className="w-56" aria-label={t("reports.type")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REPORT_TYPE.map((value) => (
              <SelectItem key={value} value={value}>
                {value.replaceAll("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          loading={generate.isPending}
          onClick={() =>
            generate.mutate(
              { auctionId, type },
              { onSuccess: () => toast.success(t("reports.generated")), onError: (error) => toast.error(getErrorMessage(error)) },
            )
          }
        >
          {generate.isPending ? t("reports.generating") : t("reports.generate")}
        </Button>
      </div>
      {reports.isLoading ? <PageSkeleton rows={2} /> : null}
      {!reports.isLoading && items.length === 0 ? (
        <EmptyState size="inline" icon={FileText} title={t("reports.empty")} />
      ) : null}
      <ul className="space-y-2">
        {items.map((report) => (
          <li key={report.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4 text-sm">
            <div className="space-y-1">
              <p className="font-medium">
                {t("reports.version", { type: enumLabel(report.reportType), version: report.reportVersion })}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("reports.generatedOn", { date: formatDateTime(report.createdAt) })}
              </p>
              {report.chainVerified ? (
                <Badge variant="success">{t("reports.chainVerified")}</Badge>
              ) : (
                <Badge variant="warning">{t("reports.chainNotVerified")}</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {report.publishedAt ? (
                <>
                  <Badge variant="info">{t("reports.published")}</Badge>
                  <Button asChild size="sm" variant="ghost">
                    <Link to={`/reports/${report.id}`}>
                      <ExternalLink aria-hidden /> {tc("publicPage")}
                    </Link>
                  </Button>
                </>
              ) : canPublish ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={publish.isPending}
                  onClick={() =>
                    publish.mutate(report.id, {
                      onSuccess: () => toast.success(t("reports.publishedToast")),
                      onError: (error) => toast.error(getErrorMessage(error)),
                    })
                  }
                >
                  {t("reports.publish")}
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <section className="space-y-3 border-t pt-4" aria-labelledby={`reconciliation-${auctionId}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 id={`reconciliation-${auctionId}`} className="font-medium">{t("reports.reconciliation")}</h3>
            {reconciliation.data ? (
              <p className="text-xs text-muted-foreground">
                {t("reports.snapshot", {
                  date: formatDateTime(reconciliation.data.generatedAt),
                  hash: reconciliation.data.snapshotSha256.slice(0, 16),
                })}
              </p>
            ) : null}
          </div>
          {reconciliation.data ? (
            <Button
              size="sm"
              variant="outline"
              aria-label={t("reports.exportLabel")}
              onClick={() => {
                const blob = new Blob([JSON.stringify(reconciliation.data, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const anchor = document.createElement("a");
                anchor.href = url;
                anchor.download = `financial-reconciliation-${auctionId}.json`;
                anchor.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download className="size-4" aria-hidden /> {t("reports.export")}
            </Button>
          ) : null}
        </div>
        {reconciliation.isLoading ? <p className="text-sm text-muted-foreground">{t("reports.reconciliationLoading")}</p> : null}
        {reconciliation.isError ? (
          <p className="text-sm text-destructive">{t("reports.reconciliationError")}</p>
        ) : null}
        {reconciliation.data ? (
          <div className="space-y-4 text-sm">
            <ReconciliationGroup title={t("reports.groupDeposits")} empty={t("reports.noRecords")} rows={reconciliation.data.deposits.map((row) => ({
              label: `${statusLabel(row.status)} · ${enumLabel(row.instrumentType)}`,
              count: row.count,
              amount: row.amount,
            }))} />
            <ReconciliationGroup title={t("reports.groupPayments")} empty={t("reports.noRecords")} rows={reconciliation.data.providerPayments.map((row) => ({
              label: statusLabel(row.status), count: row.count, amount: row.amount,
            }))} />
            <ReconciliationGroup title={t("reports.groupRefunds")} empty={t("reports.noRecords")} rows={reconciliation.data.providerRefunds.map((row) => ({
              label: statusLabel(row.status), count: row.count, amount: row.amount,
            }))} />
            <ReconciliationGroup title={t("reports.groupSettlements")} empty={t("reports.noRecords")} rows={reconciliation.data.settlements.map((row) => ({
              label: statusLabel(row.status), count: row.count, amount: row.amount,
            }))} />
            {reconciliation.data.exceptions.length > 0 ? (
              <div>
                <h4 className="mb-2 font-medium text-destructive">{t("reports.exceptions")}</h4>
                <ul className="space-y-1">
                  {reconciliation.data.exceptions.map((issue) => (
                    <li key={`${issue.issue}-${issue.entityId}`} className="flex flex-wrap justify-between gap-2">
                      <span>{issue.issue.replaceAll("_", " ")} · {issue.txRef ?? issue.entityId}</span>
                      <span>{formatMoney(issue.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : <p className="text-sm text-success">{t("reports.noExceptions")}</p>}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function ReconciliationGroup({
  title,
  empty,
  rows,
}: {
  title: string;
  empty: string;
  rows: Array<{ label: string; count: string; amount: string }>;
}) {
  return (
    <div>
      <h4 className="mb-1 font-medium">{title}</h4>
      {rows.length === 0 ? <p className="text-muted-foreground">{empty}</p> : null}
      <ul className="space-y-1">
        {rows.map((row) => (
          <li key={`${title}-${row.label}`} className="flex flex-wrap justify-between gap-2">
            <span>{row.label} · {row.count}</span>
            <span>{formatMoney(row.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
