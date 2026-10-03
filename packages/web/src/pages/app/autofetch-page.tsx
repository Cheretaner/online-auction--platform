import { useId, useState, type FormEvent } from "react";
import { CheckCircle2, ChevronDown, Inbox, Radar, RefreshCw, XCircle } from "lucide-react";
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
  useAutofetchConflicts,
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
  const { organizationId } = useAuth();
  const sources = useAutofetchSources();
  const pending = useAutofetchPending();
  const stats = useAutofetchStats();
  const auctions = useOrgAuctions(organizationId ?? undefined);
  const fetchSource = useFetchAutofetchSource();
  const sourceItems = sources.data?.items ?? [];
  const pendingItems = pending.data?.items ?? [];
  const t = useT("tools");

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("autofetch.title")}
        description={t("autofetch.description")}
      />

      <section aria-label={t("autofetch.totals")} className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t("autofetch.pending")} value={String(stats.data?.pending ?? 0)} icon={Inbox} loading={stats.isLoading} />
        <StatCard label={t("autofetch.approved")} value={String(stats.data?.approved ?? 0)} icon={CheckCircle2} loading={stats.isLoading} />
        <StatCard label={t("autofetch.rejected")} value={String(stats.data?.rejected ?? 0)} icon={XCircle} loading={stats.isLoading} />
      </section>

      <section className="space-y-4">
        <SectionHeader
          title={t("autofetch.queue")}
          description={t("autofetch.queueDescription")}
        />
        {pending.isLoading ? (
          <PageSkeleton rows={2} />
        ) : pending.isError ? (
          <ErrorState error={pending.error} onRetry={() => void pending.refetch()} />
        ) : pendingItems.length === 0 ? (
          <EmptyState size="inline" icon={Inbox} title={t("autofetch.queueEmpty")} />
        ) : (
          <ul className="space-y-4">
            {pendingItems.map((item) => (
              <li key={item.id}>
                <QueueItem item={item} auctions={auctions.data?.items ?? []} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <SectionHeader title={t("autofetch.sources")} />
        {sources.isLoading ? (
          <PageSkeleton rows={2} />
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
                <Button
                  size="sm"
                  variant="outline"
                  loading={fetchSource.isPending && fetchSource.variables === source.id}
                  disabled={fetchSource.isPending}
                  onClick={() =>
                    fetchSource.mutate(source.id, {
                      onSuccess: (result) => toast.message(t("autofetch.fetchSummary", { ...result })),
                      onError: (error) => toast.error(getErrorMessage(error)),
                    })
                  }
                >
                  {fetchSource.isPending && fetchSource.variables === source.id ? null : <RefreshCw aria-hidden />}
                  {t("autofetch.fetch")}
                </Button>
                <div className="w-full text-xs text-muted-foreground">
                  {source.lastFetchStatus === "failed" ? (
                    <>
                      <p className="text-destructive">{t("autofetch.lastFetchFailure", { error: source.lastFetchError ?? "Unknown error" })}</p>
                      {source.lastFetchedAt && <p>{t("autofetch.lastFetched", { time: new Date(source.lastFetchedAt).toLocaleString() })}</p>}
                    </>
                  ) : source.lastFetchStatus === "running" ? (
                    <p>{t("autofetch.fetchRunning")}</p>
                  ) : source.lastFetchedAt ? (
                    <p>{t("autofetch.lastFetched", { time: new Date(source.lastFetchedAt).toLocaleString() })}</p>
                  ) : (
                    <p>{t("autofetch.neverFetched")}</p>
                  )}
                  {source.lastFetchStatus === "success" && source.lastFetchSummary && (
                    <p>
                      {t("autofetch.fetchSummary", {
                        fetched: source.lastFetchSummary.fetched ?? 0,
                        queued: source.lastFetchSummary.queued ?? 0,
                        duplicates: source.lastFetchSummary.duplicates ?? 0,
                        stale: source.lastFetchSummary.stale ?? 0,
                        errors: source.lastFetchSummary.errors ?? 0,
                        conflicts: source.lastFetchSummary.conflicts ?? 0,
                      })}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <AddSourceForm />
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
  const [mappingText, setMappingText] = useState("");
  const t = useT("tools");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    let adapterConfig: Record<string, unknown> = {};
    if (adapterType === "web-scraper" && mappingText.trim()) {
      try {
        const parsed: unknown = JSON.parse(mappingText);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Expected a JSON object");
        adapterConfig = { mappings: parsed as Record<string, unknown> };
      } catch {
        toast.error(t("autofetch.invalidMappings"));
        return;
      }
    }
    createSource.mutate(
      { name, adapterType, sourceUrl: url, adapterConfig },
      {
        onSuccess: () => {
          toast.success(t("autofetch.sourceAdded"));
          setName("");
          setUrl("");
          setMappingText("");
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
        <form className="grid gap-4 md:grid-cols-[1fr_1.4fr_14rem_auto] md:items-end" onSubmit={submit}>
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
              <option value="web-scraper">{t("autofetch.webScraper")}</option>
            </NativeSelect>
          </div>
          <Button type="submit" loading={createSource.isPending}>
            {t("autofetch.add")}
          </Button>
          {adapterType === "web-scraper" && (
            <div className="space-y-1.5 md:col-span-4">
              <Label htmlFor={`${id}-mappings`}>{t("autofetch.mappings")}</Label>
              <Textarea
                id={`${id}-mappings`}
                value={mappingText}
                onChange={(event) => setMappingText(event.target.value)}
                placeholder={'{"title":"name","estimatedValue":"offers.price","region":"address.addressRegion"}'}
                spellCheck={false}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">{t("autofetch.mappingsHelp")}</p>
            </div>
          )}
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
  const [showConflicts, setShowConflicts] = useState(false);
  const conflictDetails = useAutofetchConflicts(item.id, showConflicts);
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
            <p className="mt-2 text-sm text-muted-foreground">{item.description || t("autofetch.noDescription")}</p>
            {(item.estimatedValue != null || item.categoryName) && (
              <p className="mt-1 text-xs text-muted-foreground">
                {item.estimatedValue != null && new Intl.NumberFormat(undefined, { style: "currency", currency: "ETB" }).format(item.estimatedValue)}
                {item.estimatedValue != null && item.categoryName ? " · " : ""}
                {item.categoryName}
              </p>
            )}
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {safePublicUrl(item.externalId) && (
                <a className="underline underline-offset-2" href={safePublicUrl(item.externalId)} target="_blank" rel="noopener noreferrer">
                  {t("autofetch.openSource")}
                </a>
              )}
              {safePublicUrl(item.sourceUrl) && (
                <a className="underline underline-offset-2 text-muted-foreground" href={safePublicUrl(item.sourceUrl)} target="_blank" rel="noopener noreferrer">
                  {t("autofetch.sourceEndpoint")}
                </a>
              )}
            </p>
          </div>
          <Badge variant={item.highSeverityConflicts ? "destructive" : conflicts ? "warning" : "muted"}>
            {conflicts === 1 ? t("autofetch.conflictsOne") : t("autofetch.conflictsOther", { count: conflicts })}
          </Badge>
        </div>

        <div className="grid gap-4 border-t pt-5 lg:grid-cols-2">
          {conflicts > 0 && (
            <section className="space-y-2 lg:col-span-2" aria-label={t("autofetch.conflictsDetails")}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-expanded={showConflicts}
                onClick={() => setShowConflicts((value) => !value)}
              >
                <ChevronDown aria-hidden className={showConflicts ? "rotate-180" : undefined} />
                {t("autofetch.reviewConflicts", { count: conflicts })}
              </Button>
              {showConflicts && (
                conflictDetails.isLoading ? <p className="text-sm text-muted-foreground">{t("autofetch.loadingConflicts")}</p> :
                conflictDetails.isError ? <p className="text-sm text-destructive">{getErrorMessage(conflictDetails.error)}</p> :
                <ul className="space-y-2 rounded-md border p-3 text-sm">
                  {(conflictDetails.data?.conflicts ?? []).map((conflict) => (
                    <li key={conflict.id}>
                      <strong>{conflict.severity}</strong> · {conflict.conflictType.replaceAll("_", " ")} · {conflict.confidenceScore}%
                      {conflict.conflictingAuctionId && <span className="text-muted-foreground"> · {t("autofetch.auctionId", { id: conflict.conflictingAuctionId })}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
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
                {auctions.map((auction) => (
                  <option key={auction.id} value={auction.id}>
                    {auction.title}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <Button type="submit" disabled={!auctionId || reject.isPending} loading={approve.isPending}>
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

function safePublicUrl(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}
