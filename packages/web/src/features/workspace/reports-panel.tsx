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
import { formatDateTime, formatMoney } from "@/lib/format";

type ReportType = (typeof REPORT_TYPE)[number];

export function ReportsPanel({ auctionId, canPublish }: { auctionId: string; canPublish: boolean }) {
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
          <SelectTrigger className="w-56" aria-label="Report type">
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
              { onSuccess: () => toast.success("Report generated"), onError: (error) => toast.error(getErrorMessage(error)) },
            )
          }
        >
          {generate.isPending ? "Generating…" : "Generate report"}
        </Button>
      </div>
      {reports.isLoading ? <PageSkeleton rows={2} /> : null}
      {!reports.isLoading && items.length === 0 ? (
        <EmptyState size="inline" icon={FileText} title="No reports generated yet" />
      ) : null}
      <ul className="space-y-2">
        {items.map((report) => (
          <li key={report.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4 text-sm">
            <div className="space-y-1">
              <p className="font-medium capitalize">
                {report.reportType.replaceAll("_", " ")} v{report.reportVersion}
              </p>
              <p className="text-xs text-muted-foreground">
                Generated {formatDateTime(report.createdAt)}
              </p>
              {report.chainVerified ? (
                <Badge variant="success">Audit chain verified</Badge>
              ) : (
                <Badge variant="warning">Audit chain not verified</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {report.publishedAt ? (
                <>
                  <Badge variant="info">Published</Badge>
                  <Button asChild size="sm" variant="ghost">
                    <Link to={`/reports/${report.id}`}>
                      <ExternalLink aria-hidden /> Public page
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
                      onSuccess: () => toast.success("Report published"),
                      onError: (error) => toast.error(getErrorMessage(error)),
                    })
                  }
                >
                  Publish
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <section className="space-y-3 border-t pt-4" aria-labelledby={`reconciliation-${auctionId}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 id={`reconciliation-${auctionId}`} className="font-medium">Financial reconciliation</h3>
            {reconciliation.data ? (
              <p className="text-xs text-muted-foreground">
                Snapshot {formatDateTime(reconciliation.data.generatedAt)} · SHA-256 {reconciliation.data.snapshotSha256.slice(0, 16)}…
              </p>
            ) : null}
          </div>
          {reconciliation.data ? (
            <Button
              size="sm"
              variant="outline"
              aria-label="Download financial reconciliation JSON"
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
              <Download className="size-4" aria-hidden /> Export
            </Button>
          ) : null}
        </div>
        {reconciliation.isLoading ? <p className="text-sm text-muted-foreground">Loading reconciliation…</p> : null}
        {reconciliation.isError ? (
          <p className="text-sm text-destructive">Could not load financial reconciliation. Refresh the auction workspace and try again.</p>
        ) : null}
        {reconciliation.data ? (
          <div className="space-y-4 text-sm">
            <ReconciliationGroup title="Deposits" rows={reconciliation.data.deposits.map((row) => ({
              label: `${row.status} · ${row.instrumentType.replaceAll("_", " ")}`,
              count: row.count,
              amount: row.amount,
            }))} />
            <ReconciliationGroup title="Provider payments" rows={reconciliation.data.providerPayments.map((row) => ({
              label: row.status.replaceAll("_", " "), count: row.count, amount: row.amount,
            }))} />
            <ReconciliationGroup title="Refunds" rows={reconciliation.data.providerRefunds.map((row) => ({
              label: row.status.replaceAll("_", " "), count: row.count, amount: row.amount,
            }))} />
            <ReconciliationGroup title="Winner settlements" rows={reconciliation.data.settlements.map((row) => ({
              label: row.status.replaceAll("_", " "), count: row.count, amount: row.amount,
            }))} />
            {reconciliation.data.exceptions.length > 0 ? (
              <div>
                <h4 className="mb-2 font-medium text-destructive">Exceptions</h4>
                <ul className="space-y-1">
                  {reconciliation.data.exceptions.map((issue) => (
                    <li key={`${issue.issue}-${issue.entityId}`} className="flex flex-wrap justify-between gap-2">
                      <span>{issue.issue.replaceAll("_", " ")} · {issue.txRef ?? issue.entityId}</span>
                      <span>{formatMoney(issue.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : <p className="text-sm text-emerald-700 dark:text-emerald-400">No reconciliation exceptions.</p>}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function ReconciliationGroup({ title, rows }: { title: string; rows: Array<{ label: string; count: string; amount: string }> }) {
  return (
    <div>
      <h4 className="mb-1 font-medium">{title}</h4>
      {rows.length === 0 ? <p className="text-muted-foreground">No records</p> : null}
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
