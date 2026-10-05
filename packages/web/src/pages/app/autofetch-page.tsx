import { useId, useState, type FormEvent } from "react";
import type { CreateAuctionItemRequest } from "@auction/shared";
import { CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Inbox, Pencil, Radar, RefreshCw, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/feedback/query-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
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
  useAutofetchConflicts,
  useAutofetchSources,
  useAutofetchStats,
  useCreateAutofetchSource,
  useFetchAutofetchSource,
  useRemoveAutofetchSource,
  useRejectAutofetchItem,
  useUpdateAutofetchSource,
} from "@/features/operations/queries";
import { getErrorMessage } from "@/lib/api/errors";
import type { Auction } from "@/lib/api/types";
import { useLocale, useT } from "@/i18n/context";

type PendingItem = NonNullable<ReturnType<typeof useAutofetchPending>["data"]>["items"][number];

function cleanImportedDescription(value: string | undefined): string {
  if (!value) return "";
  let text = value;
  for (let pass = 0; pass < 3; pass += 1) {
    const decoded = text.replace(/&(#(?:x[\da-f]+|\d+)|amp|lt|gt|quot|apos|nbsp);/gi, (entity, code: string) => {
      if (code[0] !== "#") {
        return ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " }[code.toLowerCase()] ?? entity);
      }
      const hex = code[1]?.toLowerCase() === "x";
      const point = Number.parseInt(code.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isInteger(point) && point >= 0 && point <= 0x10ffff
        ? String.fromCodePoint(point)
        : "\uFFFD";
    });
    if (decoded === text) break;
    text = decoded;
  }
  return text
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default function AutofetchPage() {
  const [queueOffset, setQueueOffset] = useState(0);
  const { organizationId, roles } = useAuth();
  const canReview = roles.includes("org_admin") || roles.includes("compliance_officer");
  const canManageSources = roles.includes("org_admin") || roles.includes("auction_officer");
  const sources = useAutofetchSources();
  const pending = useAutofetchPending(queueOffset, canReview);
  const stats = useAutofetchStats(canReview);
  const auctions = useOrgAuctions(canReview ? organizationId ?? undefined : undefined);
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
        {canReview && pending.data && pending.data.total > 5 ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{pending.data.offset + 1}–{Math.min(pending.data.offset + pending.data.items.length, pending.data.total)} of {pending.data.total}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={queueOffset === 0 || pending.isFetching} onClick={() => setQueueOffset((offset) => Math.max(0, offset - 5))}>
                <ChevronLeft aria-hidden /> Previous
              </Button>
              <Button variant="outline" size="sm" disabled={!pending.data.hasMore || pending.isFetching} onClick={() => setQueueOffset((offset) => offset + 5)}>
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
              <SourceRow key={source.id} source={source} canManage={canManageSources} />
            ))}
          </ul>
        )}
        {canManageSources ? <AddSourceForm /> : null}
      </section>
    </div>
  );
}

function SourceRow({ source, canManage }: { source: NonNullable<ReturnType<typeof useAutofetchSources>["data"]>[number]; canManage: boolean }) {
  const fetchSource = useFetchAutofetchSource();
  const updateSource = useUpdateAutofetchSource();
  const removeSource = useRemoveAutofetchSource();
  const [editing, setEditing] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [name, setName] = useState(source.name);
  const [adapterType, setAdapterType] = useState(source.adapterType);
  const [sourceUrl, setSourceUrl] = useState(source.sourceUrl ?? "");
  const [adapterConfig, setAdapterConfig] = useState(JSON.stringify(source.adapterConfig ?? {}, null, 2));
  const t = useT("tools");

  const save = (event: FormEvent) => {
    event.preventDefault();
    let parsed: unknown;
    try {
      parsed = JSON.parse(adapterConfig);
    } catch {
      toast.error("Adapter configuration must be valid JSON");
      return;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      toast.error("Adapter configuration must be a JSON object");
      return;
    }
    updateSource.mutate({
      sourceId: source.id,
      body: {
        name: name.trim(),
        adapterType,
        sourceUrl: sourceUrl.trim() || undefined,
        adapterConfig: parsed as Record<string, unknown>,
        isActive: source.isActive ?? true,
      },
    }, {
      onSuccess: () => {
        toast.success(t("autofetch.sourceUpdated"));
        setEditing(false);
      },
      onError: (error) => toast.error(getErrorMessage(error)),
    });
  };

  return (
    <>
      <li className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-medium">{source.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    <span className="font-mono">{source.adapterType}</span> · {source.sourceUrl}
                  </p>
                  {source.isActive === false ? <Badge variant="secondary">Inactive</Badge> : null}
                </div>
                {canManage ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      loading={fetchSource.isPending && fetchSource.variables === source.id}
                      disabled={fetchSource.isPending || source.isActive === false}
                      onClick={() =>
                        fetchSource.mutate(source.id, {
                          onSuccess: (result) => toast.message(t("autofetch.fetchSummary", {
                            fetched: result.fetched,
                            queued: result.queued,
                            duplicates: result.duplicates,
                            stale: result.stale,
                            errors: result.errors,
                            conflicts: result.conflicts,
                          })),
                          onError: (error) => toast.error(getErrorMessage(error)),
                        })
                      }
                    >
                      {fetchSource.isPending && fetchSource.variables === source.id ? null : <RefreshCw aria-hidden />}
                      {t("autofetch.fetch")}
                    </Button>
                    {source.isActive === false ? (
                      <Button
                        size="sm"
                        variant="outline"
                        loading={updateSource.isPending}
                        onClick={() => updateSource.mutate({
                          sourceId: source.id,
                          body: {
                            name: source.name,
                            adapterType: source.adapterType,
                            sourceUrl: source.sourceUrl ?? undefined,
                            adapterConfig: source.adapterConfig ?? {},
                            isActive: true,
                          },
                        }, {
                          onSuccess: () => toast.success(t("autofetch.sourceEnabled")),
                          onError: (error) => toast.error(getErrorMessage(error)),
                        })}
                      >
                        Enable
                      </Button>
                    ) : null}
                    <Button size="sm" variant="outline" aria-label={`Edit ${source.name}`} onClick={() => {
                      setName(source.name);
                      setAdapterType(source.adapterType);
                      setSourceUrl(source.sourceUrl ?? "");
                      setAdapterConfig(JSON.stringify(source.adapterConfig ?? {}, null, 2));
                      setEditing(true);
                    }}>
                      <Pencil aria-hidden /> {t("autofetch.editSource")}
                    </Button>
                    <Button size="sm" variant="destructive" aria-label={`Remove ${source.name}`} onClick={() => setConfirmRemove(true)}>
                      <Trash2 aria-hidden /> {t("autofetch.removeSource")}
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
                  </>
                ) : null}
      </li>
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("autofetch.editSourceTitle")}</DialogTitle>
            <DialogDescription>{t("autofetch.editSourceDescription")}</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={save}>
            <div className="space-y-2">
              <Label htmlFor={`source-name-${source.id}`}>Name</Label>
              <Input id={`source-name-${source.id}`} value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`source-type-${source.id}`}>{t("autofetch.sourceType")}</Label>
              <NativeSelect id={`source-type-${source.id}`} value={adapterType} onChange={(event) => setAdapterType(event.target.value)}>
                <option value="rss-feed">RSS / Atom Feed</option>
                <option value="json-feed">JSON Feed</option>
                <option value="web-scraper">Web Scraper</option>
                <option value="telegram-rss">Telegram Channel (RSS + AI)</option>
                <option value="csv-upload">CSV Upload</option>
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`source-url-${source.id}`}>{t("autofetch.sourceUrl")}</Label>
              <Input id={`source-url-${source.id}`} type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`source-config-${source.id}`}>{t("autofetch.adapterConfiguration")}</Label>
              <Textarea id={`source-config-${source.id}`} value={adapterConfig} onChange={(event) => setAdapterConfig(event.target.value)} rows={6} className="font-mono text-xs" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(false)}>{t("autofetch.cancel")}</Button>
              <Button type="submit" loading={updateSource.isPending}>{t("autofetch.saveChanges")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("autofetch.removeSourceTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("autofetch.removeSourceDescription", { name: source.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("autofetch.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={removeSource.isPending}
              onClick={(event) => {
                event.preventDefault();
                removeSource.mutate(source.id, {
                  onSuccess: () => {
                    toast.success(t("autofetch.sourceRemoved"));
                    setConfirmRemove(false);
                  },
                  onError: (error) => toast.error(getErrorMessage(error)),
                });
              }}
            >
              {t("autofetch.removeSource")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function AddSourceForm() {
  const id = useId();
  const createSource = useCreateAutofetchSource();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [adapterType, setAdapterType] = useState("rss-feed");
  const [includeKeywordsText, setIncludeKeywordsText] = useState("");
  const [mappingText, setMappingText] = useState("");
  const [aiExtraction, setAiExtraction] = useState(true);
  const [adapterConfigText, setAdapterConfigText] = useState("{}");
  const t = useT("tools");
  const { locale } = useLocale();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    let adapterConfig: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(adapterConfigText);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Adapter configuration must be a JSON object");
      }
      adapterConfig = parsed as Record<string, unknown>;
    } catch {
      toast.error(t("autofetch.invalidMappings"));
      return;
    }
    if (adapterType === "web-scraper") {
      adapterConfig.aiExtraction = aiExtraction;
    }
    if (adapterType === "rss-feed" && includeKeywordsText.trim()) {
      adapterConfig.includeKeywords = includeKeywordsText.split(",").map((keyword) => keyword.trim()).filter(Boolean);
    }
    if (adapterType === "web-scraper" && mappingText.trim()) {
      try {
        const parsed: unknown = JSON.parse(mappingText);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Expected a JSON object");
        adapterConfig.mappings = parsed as Record<string, unknown>;
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
          setIncludeKeywordsText("");
          setMappingText("");
          setAiExtraction(true);
          setAdapterConfigText("{}");
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
              <option value="web-scraper">{t("autofetch.webScraper")}</option>
              <option value="telegram-rss">{t("autofetch.telegramFeed")}</option>
            </NativeSelect>
          </div>
          {adapterType === "json-feed" ? <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor={`${id}-config`}>Adapter configuration (JSON)</Label>
            <Textarea
              id={`${id}-config`}
              value={adapterConfigText}
              onChange={(event) => setAdapterConfigText(event.target.value)}
              rows={3}
              className="font-mono text-xs"
              placeholder={'{"itemsPath":"data.items","mappings":{"title":"name"}}'}
            />
            <p className="text-xs text-muted-foreground">Use itemsPath and mappings to map fields from the JSON feed.</p>
          </div> : null}
          <Button type="submit" loading={createSource.isPending} className="md:col-span-2 md:justify-self-end">
            {t("autofetch.add")}
          </Button>
          {(adapterType === "rss-feed" || adapterType === "telegram-rss") && (
            <div className="space-y-1.5 md:col-span-4">
              <Label htmlFor={`${id}-keywords`}>{t("autofetch.requiredKeywords")}</Label>
              <Input
                id={`${id}-keywords`}
                value={includeKeywordsText}
                onChange={(event) => setIncludeKeywordsText(event.target.value)}
                placeholder="Ethiopia, tender"
              />
              <p className="text-xs text-muted-foreground">{t("autofetch.requiredKeywordsHelp")}</p>
            </div>
          )}
          {adapterType === "web-scraper" && (
            <div className="space-y-1.5 md:col-span-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`${id}-ai-extraction`}
                  checked={aiExtraction}
                  onCheckedChange={(checked) => setAiExtraction(checked === true)}
                />
                <Label htmlFor={`${id}-ai-extraction`}>
                  {locale === "am" ? "ለተዋቀሩ ያልሆኑ ገጾች AI ጥቆማዎችን ፍቀድ" : "Allow AI suggestions for unstructured pages"}
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                {locale === "am"
                  ? "የገጹ ጽሑፍ ወደ የተዋቀረ መረጃ ሲቀየር የተጠቆሙ መስኮችና ትክክለኛ የምንጭ ጥቅሶች ይታያሉ። ውጤቱ የሰው ግምገማ ይፈልጋል፤ በራስ-ሰር አይታተምም።"
                  : "Visible page text is sent to the configured remote AI provider only when structured metadata is unavailable. Suggestions include source quotes, are capped at 45% confidence, and always require human review; they are never auto-published."}
              </p>
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
  const [showSuggestions, setShowSuggestions] = useState(false);
  const cleanDescription = cleanImportedDescription(item.description);
  const conflictDetails = useAutofetchConflicts(item.id, showConflicts);
  const pendingDetail = useAutofetchPendingDetail(item.id, showSuggestions);
  const conflicts = item.conflictCount ?? 0;
  const t = useT("tools");
  const { locale } = useLocale();
  const normalized = pendingDetail.data?.item.normalizedMetadata;
  const [reviewedOverrides, setReviewedOverrides] = useState<Partial<{
    title: string;
    description: string;
    quantity: string;
    unit: string;
    condition: string;
    value: string;
    region: string;
    city: string;
  }>>({});
  const suggestedValues = {
    title: readInput(normalized?.title) || item.title,
    description: normalized ? readInput(normalized.description) : cleanDescription,
    quantity: readInput(normalized?.quantity) || "1",
    unit: readInput(normalized?.unit),
    condition: readInput(normalized?.condition),
    value: typeof normalized?.estimatedValue === "number"
      ? normalized.estimatedValue.toFixed(2)
      : readInput(normalized?.estimatedValue),
    region: readInput(normalized?.region),
    city: readInput(normalized?.city),
  };
  const reviewed = { ...suggestedValues, ...reviewedOverrides };
  const updateReviewed = (field: keyof typeof suggestedValues, value: string) => {
    setReviewedOverrides((current) => ({ ...current, [field]: value }));
  };
  const sourceMetadata = normalized?.rawMetadata && typeof normalized.rawMetadata === "object"
    ? normalized.rawMetadata as Record<string, unknown>
    : undefined;
  const extraction = sourceMetadata?.aiExtraction && typeof sourceMetadata.aiExtraction === "object"
    ? sourceMetadata.aiExtraction as { provider?: unknown; evidence?: unknown; requiresHumanReview?: unknown }
    : undefined;
  const evidence = extraction?.evidence && typeof extraction.evidence === "object"
    ? Object.entries(extraction.evidence as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === "string")
    : [];

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
            <p className="mt-2 text-sm text-muted-foreground">{cleanDescription || t("autofetch.noDescription")}</p>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="mt-1 h-auto px-0"
              aria-expanded={showSuggestions}
              onClick={() => setShowSuggestions((value) => !value)}
            >
              <ChevronDown aria-hidden className={showSuggestions ? "rotate-180" : undefined} />
              {locale === "am" ? "የተጠቆሙ መረጃዎችንና ማስረጃቸውን ይመልከቱ" : "Review suggested fields and evidence"}
            </Button>
            {showSuggestions && (
              <section className="mt-2 space-y-2 rounded-md border bg-muted/30 p-3 text-sm" aria-label={locale === "am" ? "የምንጭ ማስረጃ" : "Source evidence"}>
                {pendingDetail.isLoading ? <p className="text-muted-foreground">{locale === "am" ? "በመጫን ላይ…" : "Loading source evidence…"}</p> : null}
                {pendingDetail.isError ? <p className="text-destructive">{getErrorMessage(pendingDetail.error)}</p> : null}
                {extraction ? (
                  <>
                    <p className="font-medium text-warning-foreground">
                      {locale === "am"
                        ? `AI ጥቆማ (${typeof extraction.provider === "string" ? extraction.provider : "AI"})። ከምንጩ ጋር ያረጋግጡ፤ ራስ-ሰር አይታተምም።`
                        : `AI suggestion (${typeof extraction.provider === "string" ? extraction.provider : "AI"}). Verify it against the source; it is never published automatically.`}
                    </p>
                    {evidence.length ? (
                      <dl className="grid gap-2 sm:grid-cols-2">
                        {evidence.map(([field, quote]) => (
                          <div className="min-w-0 rounded border bg-background p-2" key={field}>
                            <dt className="text-xs font-semibold text-muted-foreground">{fieldLabel(field, locale)}</dt>
                            <dd className="mt-1 font-medium text-foreground">
                              {locale === "am" ? "የተጠቆመው፦ " : "Suggested value: "}
                              {normalized && ["string", "number"].includes(typeof normalized[field]) ? String(normalized[field]) : (locale === "am" ? "የለም" : "not provided")}
                            </dd>
                            <dd className="mt-1 whitespace-pre-wrap text-muted-foreground">
                              {locale === "am" ? "ከምንጩ የተወሰደ ጥቅስ፦ " : "Source quote: "}“{quote}”
                            </dd>
                          </div>
                        ))}
                      </dl>
                    ) : (
                      <p className="text-muted-foreground">{locale === "am" ? "የተጠቀሰ ማስረጃ የለም።" : "No field evidence was recorded."}</p>
                    )}
                    {item.aiSuggested && normalized ? (
                      <div className="space-y-3 border-t pt-3">
                        <p className="font-semibold">{locale === "am" ? "ለማተም የተገመገሙ መረጃዎች" : "Reviewed values to publish"}</p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1"><Label htmlFor={`${id}-title`}>{fieldLabel("title", locale)}</Label><Input id={`${id}-title`} required maxLength={200} value={reviewed.title} onChange={(event) => updateReviewed("title", event.target.value)} /></div>
                          <div className="space-y-1"><Label htmlFor={`${id}-quantity`}>{fieldLabel("quantity", locale)}</Label><Input id={`${id}-quantity`} type="number" min={1} step={1} required value={reviewed.quantity} onChange={(event) => updateReviewed("quantity", event.target.value)} /></div>
                          <div className="space-y-1"><Label htmlFor={`${id}-unit`}>{fieldLabel("unit", locale)}</Label><Input id={`${id}-unit`} maxLength={30} value={reviewed.unit} onChange={(event) => updateReviewed("unit", event.target.value)} /></div>
                          <div className="space-y-1"><Label htmlFor={`${id}-condition`}>{fieldLabel("condition", locale)}</Label><NativeSelect id={`${id}-condition`} value={reviewed.condition} onChange={(event) => updateReviewed("condition", event.target.value)}><option value="">{locale === "am" ? "አልተገለጸም" : "Not specified"}</option>{["new", "used_good", "used_fair", "salvage", "unknown"].map((condition) => <option key={condition} value={condition}>{condition.replaceAll("_", " ")}</option>)}</NativeSelect></div>
                          <div className="space-y-1"><Label htmlFor={`${id}-value`}>{fieldLabel("estimatedValue", locale)}</Label><Input id={`${id}-value`} inputMode="decimal" placeholder="ETB" value={reviewed.value} onChange={(event) => updateReviewed("value", event.target.value)} /></div>
                          <div className="space-y-1"><Label htmlFor={`${id}-region`}>{fieldLabel("region", locale)}</Label><Input id={`${id}-region`} maxLength={80} value={reviewed.region} onChange={(event) => updateReviewed("region", event.target.value)} /></div>
                          <div className="space-y-1"><Label htmlFor={`${id}-city`}>{fieldLabel("city", locale)}</Label><Input id={`${id}-city`} maxLength={100} value={reviewed.city} onChange={(event) => updateReviewed("city", event.target.value)} /></div>
                          <div className="space-y-1 sm:col-span-2"><Label htmlFor={`${id}-description`}>{fieldLabel("description", locale)}</Label><Textarea id={`${id}-description`} maxLength={5000} value={reviewed.description} onChange={(event) => updateReviewed("description", event.target.value)} /></div>
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : !pendingDetail.isLoading && !pendingDetail.isError ? (
                  <p className="text-muted-foreground">{locale === "am" ? "ይህ መረጃ በAI አልተጠቆመም።" : "This record was not AI-suggested."}</p>
                ) : null}
              </section>
            )}
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
                {
                  id: item.id,
                  auctionId,
                  ...(item.aiSuggested ? {
                    corrections: {
                      title: reviewed.title.trim(),
                      description: reviewed.description,
                      quantity: Number(reviewed.quantity),
                      unit: reviewed.unit || undefined,
                      condition: reviewed.condition ? reviewed.condition as CreateAuctionItemRequest["condition"] : undefined,
                      estimatedValue: reviewed.value || null,
                      region: reviewed.region || undefined,
                      city: reviewed.city || undefined,
                    },
                  } : {}),
                },
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
            <Button type="submit" disabled={!auctionId || reject.isPending || auctions.length === 0 || (item.aiSuggested && (!showSuggestions || pendingDetail.isLoading || pendingDetail.isError || !pendingDetail.data || !reviewed.title.trim() || !Number.isInteger(Number(reviewed.quantity)) || Number(reviewed.quantity) < 1 || Boolean(reviewed.value && !/^\d+(\.\d{2})?$/.test(reviewed.value))))} loading={approve.isPending}>
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

function fieldLabel(field: string, locale: "en" | "am") {
  if (locale !== "am") return field.replaceAll(/([A-Z])/g, " $1");
  const labels: Record<string, string> = {
    title: "ርዕስ",
    description: "መግለጫ",
    estimatedValue: "ግምታዊ ዋጋ",
    categoryName: "ምድብ",
    region: "ክልል",
    city: "ከተማ",
    quantity: "ብዛት",
    unit: "መለኪያ",
    condition: "ሁኔታ",
    externalId: "የምንጭ መለያ",
  };
  return labels[field] ?? field;
}

function readInput(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
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
