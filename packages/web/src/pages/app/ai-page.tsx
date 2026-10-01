import { useState } from "react";
import { ScanSearch, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/feedback/query-state";
import { AnomalyList } from "@/features/anomalies/anomaly-list";
import { useAiAnomalies, useAiScan, useAiScanResult } from "@/features/ai/queries";
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

/** Radix forbids an empty item value, so "no auction" needs a sentinel. */
const NO_AUCTION = "none";

export default function AiPage() {
  const { session } = useAuth();
  const orgId = session?.organizationId ?? undefined;
  const auctions = useOrgAuctions(orgId);
  const options = auctions.data?.items ?? [];

  const [auctionId, setAuctionId] = useState<string>(NO_AUCTION);
  const selectedId = auctionId === NO_AUCTION ? undefined : auctionId;
  const selectedTitle = options.find((auction) => auction.id === selectedId)?.title;

  const scan = useAiScan();
  const cachedScan = useAiScanResult(selectedId);
  const scanResult: AiAnomalyScanResult | undefined = scan.data ?? cachedScan.data;

  const anomalies = useAiAnomalies();
  const items = anomalies.data?.items ?? [];
  const open = items.filter((flag) => flag.status === "open");
  const closed = items.filter((flag) => flag.status !== "open");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Anomaly review"
        description="Rule-based risk flags for your organization's auctions, with optional AI explanations. Model output is advisory and never moves money, changes a status or decides a flag on its own."
      />

      <Card>
        <CardHeader>
          <CardTitle>Run a risk scan</CardTitle>
          <CardDescription>
            Choose an auction to score its bidding against the rules. The model only explains the result.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="w-full space-y-1.5 sm:w-80">
            <Label htmlFor="ai-context">Auction</Label>
            <Select value={auctionId} onValueChange={setAuctionId}>
              <SelectTrigger id="ai-context">
                <SelectValue placeholder="No auction — generic answers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_AUCTION}>No auction — generic answers</SelectItem>
                {options.map((auction) => (
                  <SelectItem key={auction.id} value={auction.id}>
                    {auction.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            disabled={!selectedId}
            loading={scan.isPending}
            onClick={() =>
              selectedId &&
              scan.mutate(selectedId, {
                onSuccess: (result) =>
                  toast.success(result.flagged ? "Scan raised a flag" : "Scan found nothing to flag"),
                onError: (error) => toast.error(getErrorMessage(error)),
              })
            }
          >
            {scan.isPending ? null : <ShieldCheck aria-hidden />}
            {scan.isPending ? "Scanning…" : "Run risk scan"}
          </Button>
        </CardContent>
      </Card>

      {scan.isPending ? <PageSkeleton rows={2} /> : null}
      {scan.isError ? <ErrorState error={scan.error} /> : null}
      {scanResult && selectedId ? (
        <ScanResult result={scanResult} auctionTitle={selectedTitle ?? "this auction"} />
      ) : null}

      <section className="space-y-4">
        <SectionHeader
          title={
            <span className="inline-flex items-center gap-2">
              Flags
              {open.length ? <Badge variant="warning">{open.length} open</Badge> : null}
            </span>
          }
          description="A person decides every flag. An open high-severity flag blocks the award."
        />
        {anomalies.isLoading ? (
          <PageSkeleton />
        ) : anomalies.isError ? (
          <ErrorState error={anomalies.error} onRetry={() => void anomalies.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState
            size="inline"
            icon={ScanSearch}
            title="No flags yet"
            description="They appear when bidding patterns trip the scoring rules."
          />
        ) : (
          <div className="space-y-3">
            {open.length === 0 ? (
              <EmptyState size="inline" icon={ShieldCheck} title="All flags have been reviewed" />
            ) : (
              <AnomalyList items={open} />
            )}
            {closed.length > 0 ? (
              <div className="mt-8 space-y-3">
                <h3 className="eyebrow text-muted-foreground">Decided</h3>
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
  return (
    <Card>
      <CardHeader>
        <CardTitle>Risk scan: {auctionTitle}</CardTitle>
        <CardDescription>
          The score and the flag come from the deterministic rules; the model only writes the narrative.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {result.flagged && result.flag ? (
          <AnomalyList items={[result.flag]} />
        ) : (
          <Alert>
            <ShieldCheck className="size-4" aria-hidden />
            <AlertTitle>No rule triggered</AlertTitle>
            <AlertDescription>
              The scan found no bidding pattern above the scoring threshold on this auction.
            </AlertDescription>
          </Alert>
        )}
        {advisory ? (
          <div className="space-y-2 rounded-lg border bg-muted/40 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={advisory.flagged ? "warning" : "muted"}>
                {advisory.flagged ? "Model suggests a closer look" : "Model sees nothing unusual"}
              </Badge>
              <Badge variant="outline" className="font-mono">
                {advisory.provider === "stub" ? "rule-based fallback" : advisory.provider}
              </Badge>
            </div>
            <p className="text-sm">{advisory.reason ?? "The model returned no explanation."}</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No model narrative: the provider is unavailable, or the rules found nothing worth explaining.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

