import { useId, useState, type FormEvent } from "react";
import { CheckCircle2, Inbox, Radar, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/feedback/query-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { StatCard } from "@/components/ui/stat-card";
import { useAuth } from "@/features/auth/auth-provider";
import { useOrgAuctions } from "@/features/auctions/queries";
import {
  useApproveAutofetchItem,
  useAutofetchPending,
  useAutofetchSources,
  useAutofetchStats,
  useCreateAutofetchSource,
  useFetchAutofetchSource,
  useRejectAutofetchItem,
} from "@/features/operations/queries";
import { getErrorMessage } from "@/lib/api/errors";
import type { Auction } from "@/lib/api/types";

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

  return (
    <div className="space-y-8">
      <PageHeader
        title="AutoFetch review"
        description="Connect public feeds, fetch new notices, and verify each one before it becomes an auction item."
      />

      <section aria-label="Queue totals" className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Pending review" value={String(stats.data?.pending ?? 0)} icon={Inbox} loading={stats.isLoading} />
        <StatCard label="Approved" value={String(stats.data?.approved ?? 0)} icon={CheckCircle2} loading={stats.isLoading} />
        <StatCard label="Rejected" value={String(stats.data?.rejected ?? 0)} icon={XCircle} loading={stats.isLoading} />
      </section>

      <section className="space-y-4">
        <SectionHeader
          title="Verification queue"
          description="Pick the auction each verified notice should be added to, or reject it with a reason."
        />
        {pending.isLoading ? (
          <PageSkeleton rows={2} />
        ) : pending.isError ? (
          <ErrorState error={pending.error} onRetry={() => void pending.refetch()} />
        ) : pendingItems.length === 0 ? (
          <EmptyState size="inline" icon={Inbox} title="The verification queue is empty" />
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
        <SectionHeader title="Connected sources" />
        {sources.isLoading ? (
          <PageSkeleton rows={2} />
        ) : sourceItems.length === 0 ? (
          <EmptyState size="inline" icon={Radar} title="No sources configured yet" description="Add one below." />
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
                      onSuccess: () => toast.success(`Fetch finished for ${source.name}. New notices appear in the queue.`),
                      onError: (error) => toast.error(getErrorMessage(error)),
                    })
                  }
                >
                  {fetchSource.isPending && fetchSource.variables === source.id ? null : <RefreshCw aria-hidden />}
                  Fetch now
                </Button>
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

  const submit = (event: FormEvent) => {
    event.preventDefault();
    createSource.mutate(
      { name, adapterType, sourceUrl: url, adapterConfig: {} },
      {
        onSuccess: () => {
          toast.success("Source added");
          setName("");
          setUrl("");
        },
        onError: (error) => toast.error(getErrorMessage(error)),
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add a source</CardTitle>
        <CardDescription>Any public RSS, Atom or JSON feed that publishes auction or tender notices.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 md:grid-cols-[1fr_1.4fr_14rem_auto] md:items-end" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-name`}>Source name</Label>
            <Input id={`${id}-name`} required value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-url`}>Feed URL</Label>
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
            <Label htmlFor={`${id}-type`}>Feed type</Label>
            <NativeSelect id={`${id}-type`} value={adapterType} onChange={(event) => setAdapterType(event.target.value)}>
              <option value="rss-feed">RSS / Atom feed</option>
              <option value="json-feed">JSON feed</option>
            </NativeSelect>
          </div>
          <Button type="submit" loading={createSource.isPending}>
            Add source
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
  const conflicts = item.conflictCount ?? 0;

  return (
    <Card>
      <CardContent className="space-y-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg leading-snug font-semibold">{item.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {item.source ?? "Imported source"} · confidence {item.confidenceScore ?? 0}%
            </p>
          </div>
          <Badge variant={item.highSeverityConflicts ? "destructive" : conflicts ? "warning" : "muted"}>
            {conflicts} {conflicts === 1 ? "conflict" : "conflicts"}
          </Badge>
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
                  onSuccess: () => toast.success("Verified and added to the auction"),
                  onError: (error) => toast.error(getErrorMessage(error)),
                },
              );
            }}
          >
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label htmlFor={`${id}-auction`}>Add to auction</Label>
              <NativeSelect id={`${id}-auction`} value={auctionId} onChange={(event) => setAuctionId(event.target.value)}>
                <option value="">Choose an auction…</option>
                {auctions.map((auction) => (
                  <option key={auction.id} value={auction.id}>
                    {auction.title}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <Button type="submit" disabled={!auctionId || reject.isPending} loading={approve.isPending}>
              Verify and add
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
                  onSuccess: () => toast.success("Notice rejected"),
                  onError: (error) => toast.error(getErrorMessage(error)),
                },
              );
            }}
          >
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label htmlFor={`${id}-reason`}>Rejection reason</Label>
              <Input id={`${id}-reason`} value={reason} onChange={(event) => setReason(event.target.value)} />
            </div>
            <Button
              type="submit"
              variant="destructive-outline"
              disabled={!reason.trim() || approve.isPending}
              loading={reject.isPending}
            >
              Reject
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
