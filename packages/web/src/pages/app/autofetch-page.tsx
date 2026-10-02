import { useId, useState, type FormEvent } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Eye, Inbox, Radar, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/feedback/query-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { StatCard } from "@/components/ui/stat-card";
import { useAuth } from "@/features/auth/auth-provider";
import { useOrgAuctions } from "@/features/auctions/queries";
import {
  useApproveAutofetchItem,
  useAutofetchPending,
  useAutofetchPendingDetail,
  useAutofetchSources,
  useAutofetchStats,
  useCreateAutofetchSource,
  useFetchAutofetchSource,
  useRejectAutofetchItem,
} from "@/features/operations/queries";
import { getErrorMessage } from "@/lib/api/errors";
import type { Auction } from "@/lib/api/types";
import { useT } from "@/i18n/context";

type PendingItem = NonNullable<ReturnType<typeof useAutofetchPending>["data"]>["items"][number];

export default function AutofetchPage() {
  const [queueOffset, setQueueOffset] = useState(0);
  const { organizationId, roles } = useAuth();
  const canReview = roles.includes("org_admin") || roles.includes("compliance_officer");
  const canManageSources = roles.includes("org_admin") || roles.includes("auction_officer");
  const sources = useAutofetchSources();
  const pending = useAutofetchPending(queueOffset, canReview);
  const stats = useAutofetchStats(canReview);
  const auctions = useOrgAuctions(canReview ? organizationId ?? undefined : undefined);
  const fetchSource = useFetchAutofetchSource();
  const sourceItems = sources.data ?? [];
  const pendingItems = pending.data?.items ?? [];
  const draftAuctions = auctions.data?.items.filter((auction) => auction.status === "draft") ?? [];
  const t = useT("tools");

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("autofetch.title")}
        description={t("autofetch.description")}
      />

      {canReview ? (
        <section aria-label={t("autofetch.totals")} className="grid gap-4 sm:grid-cols-3">
          <StatCard label={t("autofetch.pending")} value={String(stats.data?.pending ?? 0)} icon={Inbox} loading={stats.isLoading} />
          <StatCard label={t("autofetch.approved")} value={String(stats.data?.approved ?? 0)} icon={CheckCircle2} loading={stats.isLoading} />
          <StatCard label={t("autofetch.rejected")} value={String(stats.data?.rejected ?? 0)} icon={XCircle} loading={stats.isLoading} />
        </section>
      ) : null}
      {canReview && stats.isError ? <ErrorState error={stats.error} onRetry={() => void stats.refetch()} /> : null}

      <section className="space-y-4">
        <SectionHeader
          title={t("autofetch.queue")}
          description={t("autofetch.queueDescription")}
        />
        {!canReview ? (
          <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">{t("autofetch.reviewerAccess")}</p>
        ) : pending.isLoading ? (
          <PageSkeleton rows={2} />
        ) : pending.isError ? (
          <ErrorState error={pending.error} onRetry={() => void pending.refetch()} />
        ) : pendingItems.length === 0 ? (
          <EmptyState size="inline" icon={Inbox} title={t("autofetch.queueEmpty")} />
        ) : (
          <ul className="space-y-4">
            {pendingItems.map((item) => (
              <li key={item.id}>
                <QueueItem item={item} auctions={draftAuctions} />
              </li>
            ))}
          </ul>
        )}
        {canReview && pending.data && pending.data.total > pending.data.limit ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{pending.data.offset + 1}–{Math.min(pending.data.offset + pending.data.items.length, pending.data.total)} of {pending.data.total}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={queueOffset === 0 || pending.isFetching} onClick={() => setQueueOffset((offset) => Math.max(0, offset - 50))}>
                <ChevronLeft aria-hidden /> Previous
              </Button>
              <Button variant="outline" size="sm" disabled={!pending.data.hasMore || pending.isFetching} onClick={() => setQueueOffset((offset) => offset + 50)}>
                Next <ChevronRight aria-hidden />
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="space-y-4">
        <SectionHeader title={t("autofetch.sources")} />
        {sources.isLoading ? (
          <PageSkeleton rows={2} />
        ) : sources.isError ? (
          <ErrorState error={sources.error} onRetry={() => void sources.refetch()} />
        ) : sourceItems.length === 0 ? (
          <EmptyState size="inline" icon={Radar} title={t("autofetch.noSources")} description={t("autofetch.addBelow")} />
        ) : (
          <ul className="divide-y rounded-lg border bg-card shadow-xs">
            {sourceItems.map((source) => (
              <li key={source.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-medium">{source.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    <span className="font-mono">{source.adapterType}</span> · {source.sourceUrl}
                  </p>
                </div>
                {canManageSources ? <Button
                  size="sm"
                  variant="outline"
                  loading={fetchSource.isPending && fetchSource.variables === source.id}
                  disabled={fetchSource.isPending}
                  onClick={() =>
                    fetchSource.mutate(source.id, {
                      onSuccess: (result) => toast.success(t("autofetch.fetchSummary", {
                        name: source.name,
                        queued: result.queued,
                        conflicts: result.conflicts,
                        errors: result.errors,
                      })),
                      onError: (error) => toast.error(getErrorMessage(error)),
                    })
                  }
                >
                  {fetchSource.isPending && fetchSource.variables === source.id ? null : <RefreshCw aria-hidden />}
                  {t("autofetch.fetch")}
                </Button> : null}
              </li>
            ))}
          </ul>
        )}
        {canManageSources ? <AddSourceForm /> : null}
      </section>
    </div>
  );
}

function AddSourceForm() {
  const id = useId();
  const createSource = useCreateAutofetchSource();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [adapterType, setAdapterType] = useState("rss-feed");
  const [adapterConfig, setAdapterConfig] = useState("{}");
  const t = useT("tools");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    let parsedConfig: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(adapterConfig);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Configuration must be a JSON object");
      parsedConfig = parsed as Record<string, unknown>;
    } catch (error) {
      toast.error(getErrorMessage(error));
      return;
    }
    createSource.mutate(
      { name, adapterType, sourceUrl: url, adapterConfig: parsedConfig },
      {
        onSuccess: () => {
          toast.success(t("autofetch.sourceAdded"));
          setName("");
          setUrl("");
          setAdapterConfig("{}");
        },
        onError: (error) => toast.error(getErrorMessage(error)),
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("autofetch.addSource")}</CardTitle>
      <CardDescription>{t("autofetch.addSourceDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-name`}>{t("autofetch.sourceName")}</Label>
            <Input id={`${id}-name`} required value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-url`}>{t("autofetch.feedUrl")}</Label>
            <Input
              id={`${id}-url`}
              required
              type="url"
              placeholder="https://…"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-type`}>{t("autofetch.feedType")}</Label>
            <NativeSelect id={`${id}-type`} value={adapterType} onChange={(event) => setAdapterType(event.target.value)}>
              <option value="rss-feed">{t("autofetch.rss")}</option>
              <option value="json-feed">{t("autofetch.json")}</option>
              <option value="web-scraper">{t("autofetch.website")}</option>
              <option value="telegram-rss">{t("autofetch.telegramFeed")}</option>
            </NativeSelect>
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor={`${id}-config`}>Adapter configuration (JSON)</Label>
            <Textarea
              id={`${id}-config`}
              value={adapterConfig}
              onChange={(event) => setAdapterConfig(event.target.value)}
              rows={3}
              className="font-mono text-xs"
              placeholder={'{"itemsPath":"data.items","mappings":{"title":"name"}}'}
            />
            <p className="text-xs text-muted-foreground">Use itemsPath and mappings for JSON feeds. Website and Telegram feed adapters use AI to extract notice fields.</p>
          </div>
          <Button type="submit" loading={createSource.isPending} className="md:col-span-2 md:justify-self-end">
            {t("autofetch.add")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

/** One notice awaiting review. Its auction choice and rejection reason are its own. */
function QueueItem({ item, auctions }: { item: PendingItem; auctions: Auction[] }) {
  const id = useId();
  const approve = useApproveAutofetchItem();
  const reject = useRejectAutofetchItem();
  const [auctionId, setAuctionId] = useState("");
  const [reason, setReason] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const detail = useAutofetchPendingDetail(item.id, showDetails);
  const conflicts = item.conflictCount ?? 0;
  const t = useT("tools");

  return (
    <Card>
      <CardContent className="space-y-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg leading-snug font-semibold">{item.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("autofetch.confidence", {
                source: item.source ?? t("autofetch.importedSource"),
                score: item.confidenceScore ?? 0,
              })}
            </p>
          </div>
          <Badge variant={item.highSeverityConflicts ? "destructive" : conflicts ? "warning" : "muted"}>
            {conflicts === 1 ? t("autofetch.conflictsOne") : t("autofetch.conflictsOther", { count: conflicts })}
          </Badge>
        </div>

        <div>
          <Button type="button" variant="outline" size="sm" onClick={() => setShowDetails((shown) => !shown)}>
            <Eye aria-hidden /> {showDetails ? "Hide imported details" : "Review imported details"}
          </Button>
          {showDetails ? (
            <div className="mt-3 space-y-3 rounded-md bg-muted/40 p-4 text-sm">
              {detail.isLoading ? <p className="text-muted-foreground">Loading imported details…</p> : null}
              {detail.isError ? <p className="text-destructive">{getErrorMessage(detail.error)}</p> : null}
              {detail.data ? <ImportedDetails item={detail.data.item} conflicts={detail.data.conflicts} /> : null}
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 border-t pt-5 lg:grid-cols-2">
          <form
            className="flex flex-col gap-2 sm:flex-row sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              if (!auctionId) return;
              approve.mutate(
                { id: item.id, auctionId },
                {
                  onSuccess: () => toast.success(t("autofetch.verifiedAdded")),
                  onError: (error) => toast.error(getErrorMessage(error)),
                },
              );
            }}
          >
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label htmlFor={`${id}-auction`}>{t("autofetch.addToAuction")}</Label>
              <NativeSelect id={`${id}-auction`} value={auctionId} onChange={(event) => setAuctionId(event.target.value)}>
                <option value="">{t("autofetch.chooseAuction")}</option>
                {auctions.length === 0 ? <option value="" disabled>No draft auctions available</option> : null}
                {auctions.map((auction) => (
                  <option key={auction.id} value={auction.id}>
                    {auction.title}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <Button type="submit" disabled={!auctionId || reject.isPending || auctions.length === 0} loading={approve.isPending}>
              {t("autofetch.verifyAdd")}
            </Button>
          </form>

          <form
            className="flex flex-col gap-2 sm:flex-row sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              if (!reason.trim()) return;
              reject.mutate(
                { id: item.id, reason: reason.trim() },
                {
                  onSuccess: () => toast.success(t("autofetch.noticeRejected")),
                  onError: (error) => toast.error(getErrorMessage(error)),
                },
              );
            }}
          >
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label htmlFor={`${id}-reason`}>{t("autofetch.rejectionReason")}</Label>
              <Input id={`${id}-reason`} value={reason} onChange={(event) => setReason(event.target.value)} />
            </div>
            <Button
              type="submit"
              variant="destructive-outline"
              disabled={!reason.trim() || approve.isPending}
              loading={reject.isPending}
            >
              {t("autofetch.reject")}
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}

function ImportedDetails({
  item,
  conflicts,
}: {
  item: { description?: string; normalizedMetadata?: Record<string, unknown> };
  conflicts: unknown[];
}) {
  const metadata = item.normalizedMetadata ?? {};
  const rawMetadata = (metadata.rawMetadata && typeof metadata.rawMetadata === "object"
    ? metadata.rawMetadata
    : {}) as Record<string, unknown>;
  const link = [rawMetadata.link, rawMetadata.url, metadata.sourceUrl]
    .find((value): value is string => typeof value === "string" && /^https?:\/\//i.test(value));
  const value = metadata.estimatedValue;
  const place = [metadata.city, metadata.region].filter((part): part is string => typeof part === "string" && part.length > 0).join(", ");

  return (
    <div className="space-y-3">
      {item.description ? <p className="whitespace-pre-wrap">{item.description}</p> : <p className="text-muted-foreground">No description was supplied by the source.</p>}
      <dl className="grid gap-2 sm:grid-cols-2">
        {typeof metadata.categoryName === "string" ? <div><dt className="text-muted-foreground">Suggested category</dt><dd>{metadata.categoryName}</dd></div> : null}
        {place ? <div><dt className="text-muted-foreground">Location</dt><dd>{place}</dd></div> : null}
        {typeof value === "number" ? <div><dt className="text-muted-foreground">Estimated value</dt><dd>ETB {value.toLocaleString()}</dd></div> : null}
        {typeof metadata.condition === "string" ? <div><dt className="text-muted-foreground">Condition</dt><dd>{metadata.condition}</dd></div> : null}
      </dl>
      {link ? <a className="inline-block text-primary underline" href={link} target="_blank" rel="noreferrer">Open original source</a> : null}
      {conflicts.length > 0 ? (
        <div className="space-y-1 border-t pt-3">
          <p className="font-medium">Potential matches to review</p>
          {conflicts.map((value, index) => {
            const conflict = value as { severity?: string; conflictType?: string; confidenceScore?: number };
            return <p key={`${conflict.conflictType ?? "match"}-${index}`} className="text-muted-foreground">{conflict.severity ?? "Potential"} · {conflict.conflictType ?? "possible duplicate"}{typeof conflict.confidenceScore === "number" ? ` · ${conflict.confidenceScore}% match` : ""}</p>;
          })}
        </div>
      ) : null}
    </div>
  );
}
