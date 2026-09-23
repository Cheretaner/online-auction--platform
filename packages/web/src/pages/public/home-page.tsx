import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { usePublicAuctions } from "@/features/auctions/queries";
import { AuctionCard } from "@/features/auctions/auction-card";
import { QueryState } from "@/components/feedback/query-state";
import { APP_NAME } from "@/config/env";

export default function HomePage() {
  const auctions = usePublicAuctions();
  const live = auctions.data?.items.filter((item) => item.status === "live").slice(0, 6) ?? [];

  return (
    <div className="space-y-10">
      <section className="rounded-2xl border bg-card px-6 py-12 md:px-10">
        <p className="text-sm font-medium text-primary">Transparent public procurement</p>
        <h1 className="mt-2 max-w-2xl text-4xl font-semibold md:text-5xl">{APP_NAME}</h1>
        <p className="mt-4 max-w-xl text-muted-foreground">
          Discover live auctions, place verified bids, and follow an independently auditable record from opening to award.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/auctions">Browse auctions</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/register">Register to bid</Link>
          </Button>
        </div>
      </section>
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Live now</h2>
          <Link to="/auctions" className="text-sm text-primary hover:underline">
            View all
          </Link>
        </div>
        <QueryState
          isLoading={auctions.isLoading}
          isError={auctions.isError}
          error={auctions.error}
          isEmpty={live.length === 0}
          emptyTitle="No live auctions"
          emptyDescription="Scheduled and awarded lots will appear here when they are public."
          onRetry={() => auctions.refetch()}
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {live.map((auction) => (
              <AuctionCard key={auction.id} auction={auction} />
            ))}
          </div>
        </QueryState>
      </section>
    </div>
  );
}
