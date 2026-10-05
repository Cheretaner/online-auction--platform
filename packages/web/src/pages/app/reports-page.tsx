import { ArrowUpRight, FileText, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { QueryState } from "@/components/feedback/query-state";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useReports } from "@/features/operations/queries";
import { enumLabel, formatDateTime } from "@/lib/format";
import { useT } from "@/i18n/context";

export default function ReportsPage() {
  const query = useReports();
  const t = useT("account");
  const reports = useT("auctions");
  const common = useT("common");
  const items = query.data?.items ?? [];

  return (
    <div>
      <PageHeader title={t("lists.reportsTitle")} description={t("lists.reportsDescription")} />
      <QueryState
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        isEmpty={items.length === 0}
        emptyTitle={t("lists.reportsTitle")}
        emptyDescription={t("lists.reportsEmpty")}
        emptyIcon={FileText}
        onRetry={() => void query.refetch()}
      >
        <ul className="grid gap-4 xl:grid-cols-2" aria-label={t("lists.reportsTitle")}>
          {items.map((report) => (
            <li key={report.id}>
              <Card className="h-full">
                <CardContent className="flex h-full flex-col gap-4 p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                        <FileText aria-hidden className="size-5" />
                      </span>
                      <div className="min-w-0">
                        <h2 className="font-semibold leading-snug">{reportAuctionTitle(report.reportData) ?? reports("report.title", { type: enumLabel(report.reportType) })}</h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {reports("report.title", { type: enumLabel(report.reportType) })}
                          {" · "}
                          {reports("report.version", { version: report.reportVersion })}
                        </p>
                      </div>
                    </div>
                    <Badge variant={report.chainVerified ? "success" : "warning"}>
                      {report.chainVerified ? (
                        <ShieldCheck aria-hidden />
                      ) : null}
                      {report.chainVerified
                        ? reports("report.chainVerified")
                        : reports("report.chainNotVerified")}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {report.publishedAt
                      ? reports("report.published", { date: formatDateTime(report.publishedAt) })
                      : reports("report.notPublic")}
                  </p>
                  {report.publishedAt ? (
                    <div className="mt-auto flex justify-end border-t pt-3">
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/reports/${report.id}`}>
                          {common("publicPage")} <ArrowUpRight aria-hidden />
                        </Link>
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </QueryState>
    </div>
  );
}

function reportAuctionTitle(data: Record<string, unknown>): string | undefined {
  const auction = data.auction;
  if (!auction || typeof auction !== "object" || Array.isArray(auction)) return undefined;
  return "title" in auction && typeof auction.title === "string" ? auction.title : undefined;
}
