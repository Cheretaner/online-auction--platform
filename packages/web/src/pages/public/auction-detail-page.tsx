import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { QueryState } from "@/components/feedback/query-state";
import { StatusBadge } from "@/components/feedback/status-badge";
import { useAuth } from "@/features/auth/auth-provider";
import { useAuction, useAuctionBids, useAuctionItems } from "@/features/auctions/queries";
import { BidForm } from "@/features/bidding/bid-form";
import { BidderReadinessPanel } from "@/features/bidding/bidder-readiness";
import { useBidderReadiness } from "@/features/bidding/use-bidder-readiness";
import { OpenDisputeButton } from "@/features/disputes/open-dispute-dialog";
import { AuctionDocuments } from "@/features/documents/auction-documents";
import { AuctionTransparencyPanel } from "@/features/auctions/auction-transparency-panel";
import type { Auction } from "@/lib/api/types";
import { formatDateTime, formatMoney, hasRole } from "@/lib/format";
import { subscribeToEvents } from "@/lib/realtime/sse";
import { queryKeys } from "@/lib/query/keys";

const DISPUTABLE = new Set(["live", "closed", "under_review", "awarded"]);

export default function AuctionDetailPage() {
  const { id } = useParams();
  const auction = useAuction(id);
  const items = useAuctionItems(id);
  const { isAuthenticated, session } = useAuth();
  const bids = useAuctionBids(id, isAuthenticated);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!id || !isAuthenticated) return;
    return subscribeToEvents(`auction:${id}`, () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.auctions.detail(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.auctions.bids(id) });
    });
  }, [id, isAuthenticated, queryClient]);

  const isBidder = isAuthenticated && hasRole(session?.roles ?? [], "bidder");
  const record = auction.data;

  return (
    <QueryState
      isLoading={auction.isLoading}
      isError={auction.isError}
      error={auction.error}
      onRetry={() => auction.refetch()}
    >
      {record ? (
        <div className="space-y-6">
          <PageHeader
            title={record.title}
            description={record.description ?? undefined}
            actions={<StatusBadge status={record.status} />}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label={record.auctionType === "sealed_bid" ? "Reserve basis" : "Start price"} value={formatMoney(record.startPrice)} />
            <Metric
              label="Highest bid"
              value={
                record.auctionType === "sealed_bid" && !record.sealedOpenedAt
                  ? "Sealed"
                  : Number(record.currentHighestBid ?? 0) > 0
                    ? formatMoney(record.currentHighestBid)
                    : "No bids yet"
              }
            />
            <Metric label="Bids" value={String(record.bidCount)} />
            <Metric label={record.status === "scheduled" ? "Opens" : "Closes"} value={formatDateTime(record.status === "scheduled" ? record.opensAt : record.closesAt)} />
          </div>

          <AuctionTransparencyPanel auctionId={record.id} status={record.status} />

          <Card>
            <CardHeader>
              <CardTitle>Lots</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(items.data?.items ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No lots published yet.</p>
              ) : (
                items.data?.items.map((item) => (
                  <div key={item.id} className="rounded-md border p-3">
                    <p className="font-medium">{item.title}</p>
                    {item.description ? <p className="text-sm text-muted-foreground">{item.description}</p> : null}
                    <p className="mt-1 text-xs text-muted-foreground">
                      Quantity {item.quantity} {item.unit ?? ""}
                      {item.condition ? ` · ${item.condition.replaceAll("_", " ")}` : ""}
                      {item.region ? ` · ${item.region}` : ""}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {isAuthenticated ? (
            <Card>
              <CardHeader>
                <CardTitle>Documents</CardTitle>
              </CardHeader>
              <CardContent>
                <AuctionDocuments auctionId={record.id} />
              </CardContent>
            </Card>
          ) : null}

          {isBidder ? (
            <Participation auction={record} />
          ) : !isAuthenticated ? (
            <p className="text-sm">
              <Link className="text-primary underline" to="/login" state={{ from: `/auctions/${record.id}` }}>
                Sign in
              </Link>{" "}
              or{" "}
              <Link className="text-primary underline" to="/register">
                create an account
              </Link>{" "}
              to see the tender documents and take part.
            </p>
          ) : null}

          {isAuthenticated ? (
            <Card>
              <CardHeader>
                <CardTitle>Bid activity</CardTitle>
              </CardHeader>
              <CardContent>
                {(bids.data?.items ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No bids visible yet.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {bids.data?.items.map((bid) => (
                      <li key={bid.id} className="flex justify-between gap-4 border-b py-2 last:border-0">
                        <span>
                          {bid.amount === null ? "Sealed bid" : formatMoney(bid.amount)}
                          {bid.bidderId === session?.user.id ? <span className="ml-2 text-xs text-primary">(yours)</span> : null}
                          {bid.status !== "active" ? (
                            <span className="ml-2 text-xs text-muted-foreground">{bid.status}</span>
                          ) : null}
                        </span>
                        <span className="text-muted-foreground">{formatDateTime(bid.placedAt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ) : null}

          {isBidder && DISPUTABLE.has(record.status) ? (
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span>Something wrong with how this auction ran?</span>
              <OpenDisputeButton auctionId={record.id} />
            </div>
          ) : null}
        </div>
      ) : null}
    </QueryState>
  );
}

function Participation({ auction }: { auction: Auction }) {
  const readiness = useBidderReadiness(auction);
  const open = auction.status === "live";
  const upcoming = auction.status === "scheduled";
  if (!open && !upcoming) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{open ? "Place a bid" : "Get ready to bid"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {readiness.ready ? null : <BidderReadinessPanel auction={auction} readiness={readiness} />}
        {open ? (
          <BidForm auction={auction} disabled={!readiness.ready && !readiness.loading} />
        ) : (
          <p className="text-sm text-muted-foreground">Bidding opens {formatDateTime(auction.opensAt)}.</p>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs uppercase text-muted-foreground">{label}</p>
        <p className="mt-1 text-lg font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
