import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState, PageSkeleton } from "@/components/feedback/query-state";
import { useHistoricalAuctionInsights } from "@/features/operations/queries";
import { enumLabel, formatMoney } from "@/lib/format";
import { useT } from "@/i18n/context";

export function HistoricalInsights({ auctionId }: { auctionId: string }) {
  const query = useHistoricalAuctionInsights(auctionId);
  const t = useT("workspace");
  const insight = query.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("insights.title")}</CardTitle>
        <CardDescription>{t("insights.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {query.isLoading ? <PageSkeleton rows={1} /> : null}
        {query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : null}
        {insight ? (
          <>
            <p className="text-xs text-muted-foreground">
              {t("insights.source", {
                count: insight.auctionCount,
                awarded: insight.awardedCount,
                months: insight.months,
              })}
            </p>
            <p className="text-xs text-muted-foreground">
              {[
                t("insights.criteriaType", { type: enumLabel(insight.criteria.auctionType) }),
                ...(insight.criteria.region ? [t("insights.criteriaRegion", { region: insight.criteria.region })] : []),
                ...(insight.criteria.categories.length ? [t("insights.criteriaCategories", { categories: insight.criteria.categories.join(", ") })] : []),
              ].join(" · ")}
            </p>
            {insight.auctionCount === 0 ? (
              <p className="text-sm">{t("insights.noHistory")}</p>
            ) : (
              <>
                {insight.auctionCount < 5 ? (
                  <p role="note" className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                    {t("insights.smallSample")}
                  </p>
                ) : null}
                <dl className="grid gap-3 sm:grid-cols-3">
                  <Metric label={t("insights.medianPrice")} value={insight.medianWinningPrice ? formatMoney(insight.medianWinningPrice) : t("insights.noAwards")} />
                  <Metric label={t("insights.medianBids")} value={insight.medianBidCount === null ? t("insights.unavailable") : String(insight.medianBidCount)} />
                  <Metric label={t("insights.awardRate")} value={insight.awardRate === null ? t("insights.unavailable") : `${Math.round(insight.awardRate * 100)}%`} />
                </dl>
                <p className="text-xs text-muted-foreground">{t("insights.advisory")}</p>
              </>
            )}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
