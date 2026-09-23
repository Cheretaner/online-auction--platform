import { Link } from "react-router-dom";
import type { Auction } from "@/lib/api/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/feedback/status-badge";
import { formatDateTime, formatMoney } from "@/lib/format";

export function AuctionCard({ auction }: { auction: Auction }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base">
            <Link to={`/auctions/${auction.id}`} className="hover:underline">
              {auction.title}
            </Link>
          </CardTitle>
          <StatusBadge status={auction.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <p className="line-clamp-2">{auction.description || "No description."}</p>
        <p>Current: {formatMoney(auction.currentHighestBid ?? auction.startPrice)}</p>
        <p>
          {auction.bidCount} bids · closes {formatDateTime(auction.closesAt)}
        </p>
        {auction.region ? <p>{auction.region}</p> : null}
      </CardContent>
    </Card>
  );
}
