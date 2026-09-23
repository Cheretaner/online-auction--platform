import { useMemo, useState } from "react";
import { AUCTION_STATUS } from "@auction/shared";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/layout/page-header";
import { QueryState } from "@/components/feedback/query-state";
import { AuctionCard } from "@/features/auctions/auction-card";
import { usePublicAuctions } from "@/features/auctions/queries";

export default function AuctionListPage() {
  const auctions = usePublicAuctions();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");

  const items = useMemo(() => {
    const all = auctions.data?.items ?? [];
    return all.filter((item) => {
      const matchesQuery =
        !query ||
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        (item.region ?? "").toLowerCase().includes(query.toLowerCase());
      const matchesStatus = status === "all" || item.status === status;
      return matchesQuery && matchesStatus;
    });
  }, [auctions.data?.items, query, status]);

  return (
    <div>
      <PageHeader
        title="Public auctions"
        description="The API publishes scheduled, live, closed, under-review, and awarded lots. Filtering happens in the browser because the list endpoint has no query parameters."
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-[1fr_200px]">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search title or region"
          aria-label="Search auctions"
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger aria-label="Filter by status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {AUCTION_STATUS.filter((value) =>
              ["scheduled", "live", "closed", "under_review", "awarded"].includes(value),
            ).map((value) => (
              <SelectItem key={value} value={value}>
                {value.replaceAll("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <QueryState
        isLoading={auctions.isLoading}
        isError={auctions.isError}
        error={auctions.error}
        isEmpty={items.length === 0}
        emptyTitle="No matching auctions"
        onRetry={() => auctions.refetch()}
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((auction) => (
            <AuctionCard key={auction.id} auction={auction} />
          ))}
        </div>
      </QueryState>
    </div>
  );
}
