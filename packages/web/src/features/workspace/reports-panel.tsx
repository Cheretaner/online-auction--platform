import { useState } from "react";
import { Link } from "react-router-dom";
import { REPORT_TYPE } from "@auction/shared";
import { toast } from "sonner";
import { ExternalLink, FileText } from "lucide-react";
import { EmptyState, PageSkeleton } from "@/components/feedback/query-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGenerateReport, usePublishReport, useReports } from "@/features/operations/queries";
import { getErrorMessage } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/format";

type ReportType = (typeof REPORT_TYPE)[number];

export function ReportsPanel({ auctionId, canPublish }: { auctionId: string; canPublish: boolean }) {
  const reports = useReports(auctionId);
  const generate = useGenerateReport();
  const publish = usePublishReport();
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
    </div>
  );
}
