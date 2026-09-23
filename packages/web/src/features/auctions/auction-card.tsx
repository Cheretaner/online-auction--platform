import { ArrowUpRight, CalendarClock, Gavel, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import type { Auction } from "@/lib/api/types";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/feedback/status-badge";
import { formatDateTime, formatMoney } from "@/lib/format";

export function AuctionCard({ auction }: { auction: Auction }) {
  const isLive = auction.status === "live";
  const priceLabel = auction.currentHighestBid
    ? "Current bid"
    : "Starting price";

  return (
    <Card className="group flex h-full flex-col overflow-hidden border-border/80 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg">
      <div
        className={`h-1 ${isLive ? "bg-primary" : "bg-muted-foreground/20"}`}
      />
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center justify-between gap-3">
          <StatusBadge status={auction.status} />
          <span className="text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {auction.auctionType === "sealed_bid"
              ? "Sealed bid"
              : "Open auction"}
          </span>
        </div>

        <h3 className="mt-4 min-h-12 text-lg font-semibold leading-snug">
          <Link
            to={`/auctions/${auction.id}`}
            className="rounded-sm decoration-primary decoration-2 underline-offset-4 hover:underline focus-visible:underline"
          >
            {auction.title}
          </Link>
        </h3>
        <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-relaxed text-muted-foreground">
          {auction.description ||
            "Details and conditions are available in the auction listing."}
        </p>

        <div className="mt-5 rounded-xl bg-muted/60 px-4 py-3">
          <p className="text-xs font-medium text-muted-foreground">
            {priceLabel}
          </p>
          <p className="mt-1 text-xl font-semibold tracking-tight text-foreground">
            {formatMoney(auction.currentHighestBid ?? auction.startPrice)}
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
          <div className="flex min-w-0 items-center gap-2">
            <Gavel className="size-3.5 shrink-0" aria-hidden="true" />
            <span>{auction.bidCount} bids</span>
          </div>
          {auction.region ? (
            <div className="flex min-w-0 items-center gap-2">
              <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{auction.region}</span>
            </div>
          ) : null}
          <div className="col-span-2 flex min-w-0 items-center gap-2">
            <CalendarClock className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">
              Closes {formatDateTime(auction.closesAt)}
            </span>
          </div>
        </div>

        <div className="mt-auto pt-5">
          <Link
            to={`/auctions/${auction.id}`}
            className="flex min-h-10 items-center justify-between border-t pt-3 text-sm font-medium text-primary"
          >
            <span>View auction</span>
            <ArrowUpRight
              className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
        </div>
      </div>
    </Card>
  );
}
