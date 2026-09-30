import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { ErrorState, PageSkeleton } from "@/components/feedback/query-state";
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
import { PageHeader } from "@/components/layout/page-header";
import { getErrorMessage } from "@/lib/api/errors";
import type { AiAnomalyScanResult } from "@/lib/api/types";
import { Assistant } from "@/features/ai/assistant";

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
        title="AI tools"
        description="Model output is advisory and never moves money, changes a status or decides a flag on its own."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Auction context</CardTitle>
          <CardDescription>
            Both tools below work without a context; picking an auction lets the model read its title,
            category, status and bids.
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
            variant="outline"
            disabled={!selectedId || scan.isPending}
            onClick={() =>
              selectedId &&
              scan.mutate(selectedId, {
                onSuccess: (result) =>
                  toast.success(result.flagged ? "Scan raised a flag" : "Scan found nothing to flag"),
                onError: (error) => toast.error(getErrorMessage(error)),
              })
            }
          >
            <ShieldCheck className="size-4" aria-hidden />
            {scan.isPending ? "Scanning…" : "Run risk scan"}
          </Button>
        </CardContent>
      </Card>

      {scan.isPending ? <PageSkeleton rows={2} /> : null}
      {scan.isError ? <ErrorState error={scan.error} /> : null}
      {scanResult && selectedId ? (
        <ScanResult result={scanResult} auctionTitle={selectedTitle ?? "this auction"} />
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Anomaly review ({open.length} open)</h2>
        <p className="text-sm text-muted-foreground">
          Deterministic flags across your organization&apos;s auctions. A person decides every flag; an open
          high-severity flag blocks the award.
        </p>
        {anomalies.isLoading ? (
          <PageSkeleton />
        ) : anomalies.isError ? (
          <ErrorState error={anomalies.error} onRetry={() => void anomalies.refetch()} />
        ) : items.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            No flags yet. They appear when bidding patterns trip the scoring rules.
          </p>
        ) : (
          <div className="space-y-3">
            {open.length === 0 ? (
              <p className="text-sm text-muted-foreground">All flags have been reviewed.</p>
            ) : (
              <AnomalyList items={open} />
            )}
            {closed.length > 0 ? (
              <div className="mt-6 space-y-3">
                <h3 className="font-medium">Decided</h3>
                <AnomalyList items={closed} />
              </div>
            ) : null}
          </div>
        )}
      </section>
      <Assistant auctionId={selectedId} auctionTitle={selectedTitle} />
    </div>
  );
}

/** Deterministic verdict first, model narrative second — the two never swap places. */
function ScanResult({ result, auctionTitle }: { result: AiAnomalyScanResult; auctionTitle: string }) {
  const advisory = result.advisory;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Risk scan — {auctionTitle}</CardTitle>
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
          <div className="space-y-2 rounded-lg border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={advisory.flagged ? "secondary" : "outline"}>
                {advisory.flagged ? "Model suggests a closer look" : "Model sees nothing unusual"}
              </Badge>
              <Badge variant="outline" className="font-mono text-xs">
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

