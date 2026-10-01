import { useParams } from "react-router-dom";
import { FileText, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { QueryState } from "@/components/feedback/query-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useReport } from "@/features/operations/queries";
import { formatDateTime } from "@/lib/format";

function humanize(key: string) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replaceAll("_", " ")
    .replace(/^./, (char) => char.toUpperCase());
}

function isPlain(value: unknown): value is string | number | boolean | null {
  return value === null || ["string", "number", "boolean"].includes(typeof value);
}

function formatValue(key: string, value: string | number | boolean | null) {
  if (value === null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return new Intl.NumberFormat("en-US").format(value);
  if (/(At|Date)$/.test(key) && !Number.isNaN(Date.parse(value))) return formatDateTime(value);
  return value.replaceAll("_", " ");
}

/** Shows top-level facts as a definition list; nested data gets its own titled section. */
function ReportBody({ data }: { data: unknown }) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return (
      <pre className="overflow-auto rounded-lg border bg-card p-4 font-mono text-xs leading-5">
        {JSON.stringify(data, null, 2)}
      </pre>
    );
  }
  const entries = Object.entries(data as Record<string, unknown>);
  const facts = entries.filter(([, value]) => isPlain(value)) as Array<[string, string | number | boolean | null]>;
  const sections = entries.filter(([, value]) => !isPlain(value));

  return (
    <div className="space-y-6">
      {facts.length ? (
        <Card>
          <CardContent className="p-0 sm:p-0">
            <dl className="grid sm:grid-cols-2">
              {facts.map(([key, value]) => (
                <div key={key} className="border-b p-4 sm:px-6 sm:odd:border-r">
                  <dt className="eyebrow text-muted-foreground">{humanize(key)}</dt>
                  <dd className="mt-1 font-medium capitalize tabular-nums">{formatValue(key, value)}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      ) : null}
      {sections.map(([key, value]) => (
        <Card key={key}>
          <CardHeader>
            <CardTitle>{humanize(key)}</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="overflow-auto rounded-md bg-muted p-4 font-mono text-xs leading-5">
              {JSON.stringify(value, null, 2)}
            </pre>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function ReportPublicPage() {
  const { id } = useParams();
  const report = useReport(id);
  return (
    <QueryState isLoading={report.isLoading} isError={report.isError} error={report.error} onRetry={() => report.refetch()}>
      {report.data ? (
        <div className="mx-auto max-w-4xl">
          <PageHeader
            back={{ to: "/auctions?status=awarded", label: "Published results" }}
            title={<span className="capitalize">{report.data.reportType.replaceAll("_", " ")} report</span>}
            meta={
              <>
                <Badge variant="outline">
                  <FileText aria-hidden /> Version {report.data.reportVersion}
                </Badge>
                {report.data.chainVerified ? (
                  <Badge variant="success">
                    <ShieldCheck aria-hidden /> Audit chain verified
                  </Badge>
                ) : (
                  <Badge variant="warning">Audit chain not verified</Badge>
                )}
              </>
            }
            description={
              report.data.publishedAt
                ? `Published ${formatDateTime(report.data.publishedAt)}`
                : "This report is not public yet."
            }
          />
          <ReportBody data={report.data.reportData} />
        </div>
      ) : null}
    </QueryState>
  );
}
