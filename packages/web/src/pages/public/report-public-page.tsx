import { Link, useParams } from "react-router-dom";
import { PageHeader } from "@/components/layout/page-header";
import { QueryState } from "@/components/feedback/query-state";
import { useReport } from "@/features/operations/queries";
import { formatDateTime } from "@/lib/format";

export default function ReportPublicPage() {
  const { id } = useParams();
  const report = useReport(id);
  return (
    <QueryState isLoading={report.isLoading} isError={report.isError} error={report.error} onRetry={() => report.refetch()}>
      {report.data ? (
        <div>
          <PageHeader
            title={`${report.data.type.replaceAll("_", " ")} report`}
            description={
              report.data.publishedAt
                ? `Published ${formatDateTime(report.data.publishedAt)}`
                : "This report is not public yet."
            }
          />
          <pre className="overflow-auto rounded-lg border bg-card p-4 text-sm">
            {JSON.stringify(report.data.content ?? report.data, null, 2)}
          </pre>
          <p className="mt-4 text-sm">
            <Link to="/" className="text-primary underline">
              Back home
            </Link>
          </p>
        </div>
      ) : null}
    </QueryState>
  );
}
