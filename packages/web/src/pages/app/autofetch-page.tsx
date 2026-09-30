import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

export default function AutofetchPage() {
  const { organizationId } = useAuth();
  const sources = useAutofetchSources();
  const pending = useAutofetchPending();
  const stats = useAutofetchStats();
  const auctions = useOrgAuctions(organizationId ?? undefined);
  const createSource = useCreateAutofetchSource();
  const fetchSource = useFetchAutofetchSource();
  const approve = useApproveAutofetchItem();
  const reject = useRejectAutofetchItem();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [adapterType, setAdapterType] = useState("rss-feed");
  const [selectedAuction, setSelectedAuction] = useState("");
  const [reason, setReason] = useState("");

  const submitSource = (event: React.FormEvent) => {
    event.preventDefault();
    createSource.mutate({ name, adapterType, sourceUrl: url, adapterConfig: {} }, { onSuccess: () => { setName(""); setUrl(""); } });
  };

  return (
    <div className="space-y-8">
      <PageHeader title="AutoFetch review" description="Connect public feeds, fetch new notices, and verify them before adding auction items." />
      <Card><CardContent className="p-5">
        <h2 className="font-medium">Add a source</h2>
        <form className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_180px_auto]" onSubmit={submitSource}>
          <Input required placeholder="Source name" value={name} onChange={(event) => setName(event.target.value)} />
          <Input required type="url" placeholder="Public RSS or JSON URL" value={url} onChange={(event) => setUrl(event.target.value)} />
          <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={adapterType} onChange={(event) => setAdapterType(event.target.value)}>
            <option value="rss-feed">RSS / Atom social feed</option>
            <option value="json-feed">JSON feed</option>
          </select>
          <Button type="submit" disabled={createSource.isPending}>{createSource.isPending ? "Adding..." : "Add source"}</Button>
        </form>
        {createSource.isError ? <p className="mt-3 text-sm text-destructive">{getErrorMessage(createSource.error)}</p> : null}
      </CardContent></Card>

      <section className="grid gap-4 md:grid-cols-3">
        <Stat label="Pending review" value={stats.data?.pending ?? 0} />
        <Stat label="Approved" value={stats.data?.approved ?? 0} />
        <Stat label="Rejected" value={stats.data?.rejected ?? 0} />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Connected sources</h2>
        <div className="space-y-3">
          {(sources.data?.items ?? []).map((source) => <Card key={source.id}><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="font-medium">{source.name}</p><p className="text-xs text-muted-foreground">{source.adapterType} · {source.sourceUrl}</p></div><Button size="sm" variant="outline" onClick={() => fetchSource.mutate(source.id)} disabled={fetchSource.isPending}>{fetchSource.isPending ? "Fetching..." : "Fetch now"}</Button></CardContent></Card>)}
          {!sources.isLoading && !(sources.data?.items?.length) ? <p className="text-sm text-muted-foreground">No sources configured yet.</p> : null}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Verification queue</h2>
        <div className="space-y-4">
          {(pending.data?.items ?? []).map((item) => <Card key={item.id}><CardContent className="space-y-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-medium">{item.title}</h3><p className="mt-1 text-sm text-muted-foreground">{item.source ?? "Imported source"} · confidence {item.confidenceScore ?? 0}%</p></div><Badge variant={item.highSeverityConflicts ? "destructive" : "secondary"}>{item.conflictCount ?? 0} conflicts</Badge></div>
            <div className="flex flex-wrap items-center gap-3"><select className="h-10 min-w-64 rounded-md border border-input bg-background px-3 text-sm" value={selectedAuction} onChange={(event) => setSelectedAuction(event.target.value)}><option value="">Choose auction to add item...</option>{(auctions.data?.items ?? []).map((auction) => <option key={auction.id} value={auction.id}>{auction.title}</option>)}</select><Button size="sm" onClick={() => selectedAuction && approve.mutate({ id: item.id, auctionId: selectedAuction })} disabled={!selectedAuction || approve.isPending}>Verify and add</Button><Input className="max-w-xs" placeholder="Rejection reason" value={reason} onChange={(event) => setReason(event.target.value)} /><Button size="sm" variant="destructive" onClick={() => reason.trim() && reject.mutate({ id: item.id, reason })} disabled={!reason.trim() || reject.isPending}>Reject</Button></div>
          </CardContent></Card>)}
          {!pending.isLoading && !(pending.data?.items?.length) ? <p className="text-sm text-muted-foreground">The verification queue is empty.</p> : null}
          {pending.isError ? <p className="text-sm text-destructive">{getErrorMessage(pending.error)}</p> : null}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></CardContent></Card>;
}
