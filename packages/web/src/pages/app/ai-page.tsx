import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ScanSearch, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/feedback/query-state";
import { AnomalyList } from "@/features/anomalies/anomaly-list";
import { useAiAnomalies, useAiAnomaly, useAiScan, useAiScanResult } from "@/features/ai/queries";
import { useOrgAuctions } from "@/features/auctions/queries";
import { useAuth } from "@/features/auth/auth-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { getErrorMessage } from "@/lib/api/errors";
import type { AiAnomalyScanResult } from "@/lib/api/types";
import { useT } from "@/i18n/context";

/** Radix forbids an empty item value, so "no auction" needs a sentinel. */
const NO_AUCTION = "none";

export default function AiPage() {
  const [searchParams] = useSearchParams();
  const focusedFlag = useAiAnomaly(searchParams.get("flagId") ?? undefined);
  const { session } = useAuth();
  const orgId = session?.organizationId ?? undefined;
  const auctions = useOrgAuctions(orgId);
  const options = auctions.data?.items ?? [];

  const [auctionId, setAuctionId] = useState<string>(NO_AUCTION);
  const selectedId = auctionId === NO_AUCTION ? undefined : auctionId;
  const selectedTitle = options.find((auction) => auction.id === selectedId)?.title;

  const scan = useAiScan();
  const cachedScan = useAiScanResult(selectedId);
  const scanResult: AiAnomalyScanResult | undefined =
    scan.variables === selectedId ? scan.data : cachedScan.data;

  const anomalies = useAiAnomalies();
  const items = anomalies.data?.items ?? [];
  const open = items.filter((flag) => flag.status === "open");
  const closed = items.filter((flag) => flag.status !== "open");
  const t = useT("tools");

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("anomaly.title")}
        description={t("anomaly.description")}
      />

      <Card>
        <CardHeader>
          <CardTitle>{t("anomaly.scanTitle")}</CardTitle>
          <CardDescription>{t("anomaly.scanDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="w-full space-y-1.5 sm:w-80">
            <Label htmlFor="ai-context">{t("anomaly.auction")}</Label>
            <Select value={auctionId} onValueChange={setAuctionId}>
              <SelectTrigger id="ai-context">
                <SelectValue placeholder={t("anomaly.noAuction")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_AUCTION}>{t("anomaly.noAuction")}</SelectItem>
                {options.map((auction) => (
                  <SelectItem key={auction.id} value={auction.id}>
                    {auction.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {auctions.isLoading ? <p role="status" className="text-xs text-muted-foreground">{t("anomaly.loadingAuctions")}</p> : null}
          </div>
          <Button
            type="button"
            disabled={!selectedId || scan.isPending || auctions.isLoading || auctions.isError}
            loading={scan.isPending}
            onClick={() =>
              selectedId &&
              scan.mutate(selectedId, {
                onSuccess: (result) =>
                  toast.success(result.flagged ? t("anomaly.flagged") : t("anomaly.clean")),
                onError: (error) => toast.error(getErrorMessage(error)),
              })
            }
          >
            {scan.isPending ? null : <ShieldCheck aria-hidden />}
            {scan.isPending ? t("anomaly.scanning") : t("anomaly.scan")}
          </Button>
          {auctions.isError ? (
            <div className="w-full">
              <ErrorState error={auctions.error} onRetry={() => void auctions.refetch()} />
            </div>
          ) : null}
        </CardContent>
      </Card>

      {scan.isPending && scan.variables === selectedId ? <PageSkeleton rows={2} /> : null}
      {scan.isError && scan.variables === selectedId ? <ErrorState error={scan.error} /> : null}
      {scanResult && selectedId ? (
        <ScanResult result={scanResult} auctionTitle={selectedTitle ?? t("anomaly.thisAuction")} />
      ) : null}

      {searchParams.get("flagId") ? (
        <section className="space-y-3">
          <SectionHeader title={t("anomaly.relatedRecord")} description={t("anomaly.relatedRecordDescription")} />
          {focusedFlag.isLoading ? <PageSkeleton rows={1} /> : null}
          {focusedFlag.isError ? <ErrorState error={focusedFlag.error} /> : null}
          {focusedFlag.data ? <AnomalyList items={[focusedFlag.data]} /> : null}
        </section>
      ) : null}

      <section className="space-y-4">
        <SectionHeader
          title={
            <span className="inline-flex items-center gap-2">
              {t("anomaly.flags")}
              {open.length ? <Badge variant="warning">{t("anomaly.openCount", { count: open.length })}</Badge> : null}
            </span>
          }
          description={t("anomaly.flagsDescription")}
        />
        {anomalies.isLoading ? (
          <PageSkeleton />
        ) : anomalies.isError ? (
          <ErrorState error={anomalies.error} onRetry={() => void anomalies.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState
            size="inline"
            icon={ScanSearch}
            title={t("anomaly.emptyTitle")}
            description={t("anomaly.emptyBody")}
          />
        ) : (
          <div className="space-y-3">
            {open.length === 0 ? (
              <EmptyState size="inline" icon={ShieldCheck} title={t("anomaly.allReviewed")} />
            ) : (
              <AnomalyList items={open} />
            )}
            {closed.length > 0 ? (
              <div className="mt-8 space-y-3">
                <h3 className="eyebrow text-muted-foreground">{t("anomaly.decided")}</h3>
                <AnomalyList items={closed} />
              </div>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}

/** Deterministic verdict first, model narrative second — the two never swap places. */
function ScanResult({ result, auctionTitle }: { result: AiAnomalyScanResult; auctionTitle: string }) {
  const advisory = result.advisory;
  const t = useT("tools");
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("anomaly.resultTitle", { title: auctionTitle })}</CardTitle>
        <CardDescription>{t("anomaly.resultDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {result.flagged && result.flag ? (
          <AnomalyList items={[result.flag]} />
        ) : (
          <Alert>
            <ShieldCheck className="size-4" aria-hidden />
            <AlertTitle>{t("anomaly.noRule")}</AlertTitle>
            <AlertDescription>{t("anomaly.noRuleBody")}</AlertDescription>
          </Alert>
        )}
        {advisory ? (
          <div className="space-y-2 rounded-lg border bg-muted/40 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={advisory.flagged ? "warning" : "muted"}>
                {advisory.flagged ? t("anomaly.modelLook") : t("anomaly.modelFine")}
              </Badge>
              <Badge variant="outline" className="font-mono">
                {advisory.provider === "stub" ? t("anomaly.fallback") : advisory.provider}
              </Badge>
            </div>
            <p className="text-sm">{advisory.reason ?? t("anomaly.noExplanation")}</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("anomaly.noNarrative")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
