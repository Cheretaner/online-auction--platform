import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Gavel, Lock, MapPin, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, ErrorState, QueryState } from "@/components/feedback/query-state";
import { StatusBadge } from "@/components/feedback/status-badge";
import { useAuth } from "@/features/auth/auth-provider";
import { useAuction, useAuctionBids, useAuctionItems } from "@/features/auctions/queries";
import { BidForm } from "@/features/bidding/bid-form";
import { BidderReadinessPanel } from "@/features/bidding/bidder-readiness";
import { useBidderReadiness } from "@/features/bidding/use-bidder-readiness";
import { OpenDisputeButton } from "@/features/disputes/open-dispute-dialog";
import { AuctionDocuments } from "@/features/documents/auction-documents";
import { AuctionTransparencyPanel } from "@/features/auctions/auction-transparency-panel";
import { WatchlistControls } from "@/features/auctions/watchlist-controls";
import type { Auction } from "@/lib/api/types";
import { enumLabel, formatDateTime, formatMoney, hasRole, regionLabel, statusLabel } from "@/lib/format";
import { useT } from "@/i18n/context";
import { subscribeToEvents } from "@/lib/realtime/sse";
import { queryKeys } from "@/lib/query/keys";

const DISPUTABLE = new Set(["live", "closed", "under_review", "awarded"]);
const PARTICIPATION_STATUSES = new Set(["scheduled", "live"]);

export default function AuctionDetailPage() {
  const { id } = useParams();
  const auction = useAuction(id);
  const items = useAuctionItems(id);
  const { isAuthenticated, session } = useAuth();
  const bids = useAuctionBids(id, isAuthenticated, { cacheOwnHistory: hasRole(session?.roles ?? [], "bidder") });
  const queryClient = useQueryClient();
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    if (!id || !isAuthenticated) return;
    return subscribeToEvents(`auction:${id}`, () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.auctions.detail(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.auctions.bids(id) });
    });
  }, [id, isAuthenticated, queryClient]);

  const isBidder = isAuthenticated && hasRole(session?.roles ?? [], "bidder");
  const canReviewDocuments = (session?.roles ?? []).some((role) =>
    ["auction_officer", "org_admin", "compliance_officer", "super_admin"].includes(role),
  );
  const record = auction.data;
  const t = useT("auctions");

  // Decide up-front what the sidebar will hold, so the grid never reserves an empty column.
  const canParticipate = Boolean(record && isBidder && PARTICIPATION_STATUSES.has(record.status));
  const showSignInCard = !isAuthenticated;
  const showWatchlist = Boolean(record && isAuthenticated && PARTICIPATION_STATUSES.has(record.status));
  const hasAside = canParticipate || showSignInCard || showWatchlist;

  return (
    <QueryState
      isLoading={auction.isLoading}
      isError={auction.isError && !auction.data}
      error={auction.error}
      onRetry={() => auction.refetch()}
    >
      {record ? (
        <div className="space-y-6">
          {!online ? (
            <p role="status" className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
              {t("detail.offlineCached", { time: formatDateTime(new Date(auction.dataUpdatedAt).toISOString()) })}
            </p>
          ) : null}
          <PageHeader
            back={{ to: "/auctions", label: t("detail.back") }}
            title={record.title}
            meta={
              <>
                <StatusBadge status={record.status} />
                <Badge variant="outline">
                  {record.auctionType === "sealed_bid" ? <Lock aria-hidden /> : <Gavel aria-hidden />}
                  {enumLabel(record.auctionType)}
                </Badge>
                {record.region ? (
                  <Badge variant="outline">
                    <MapPin aria-hidden /> {regionLabel(record.region)}
                  </Badge>
                ) : null}
              </>
            }
            description={record.description ?? undefined}
          />

          <KeyFacts auction={record} />

          {/* Two columns only when the sidebar has content; otherwise the main column uses the full width. */}
          <div className={`grid items-start gap-6 ${hasAside ? "lg:grid-cols-[minmax(0,1fr)_24rem]" : ""}`}>
            <div className="order-2 min-w-0 space-y-6 lg:order-1">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle>{t("detail.lots")}</CardTitle>
                    {items.data?.items?.length ? (
                      <Badge variant="outline" className="tabular-nums">
                        {items.data.items.length}
                      </Badge>
                    ) : null}
                  </div>
                  <CardDescription>{t("detail.lotsDescription")}</CardDescription>
                </CardHeader>
                <CardContent aria-busy={items.isLoading}>
                  {items.isLoading ? (
                    <p role="status" className="text-sm text-muted-foreground">{t("detail.loadingLots")}</p>
                  ) : items.isError ? (
                    <ErrorState error={items.error} onRetry={() => void items.refetch()} />
                  ) : (items.data?.items ?? []).length === 0 ? (
                    <EmptyState size="inline" icon={Package} title={t("detail.noLots")} />
                  ) : (
                    <ul
                      className={`grid gap-3 ${
                        !hasAside && (items.data?.items.length ?? 0) > 1 ? "md:grid-cols-2" : ""
                      }`}
                    >
                      {items.data?.items.map((item) => (
                        <li key={item.id} className="rounded-lg border bg-card p-4">
                          <p className="font-medium">{item.title}</p>
                          {item.description ? (
                            <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.description}</p>
                          ) : null}
                          <p className="mt-2 text-xs text-muted-foreground capitalize">
                            {t("detail.quantity", { quantity: item.quantity, unit: item.unit ?? "" })}
                            {item.condition ? ` · ${enumLabel(item.condition)}` : ""}
                            {item.region ? ` · ${regionLabel(item.region)}` : ""}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              {isAuthenticated ? (
                // With no sidebar, documents and bid activity sit side by side instead of leaving the right half blank.
                <div className={`grid items-start gap-6 ${hasAside ? "" : "xl:grid-cols-2"}`}>
                  <Card className="min-w-0">
                    <CardHeader>
                      <CardTitle>{t("detail.documents")}</CardTitle>
                      <CardDescription>{t("detail.documentsDescription")}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <AuctionDocuments auctionId={record.id} canReview={canReviewDocuments} />
                    </CardContent>
                  </Card>

                  <Card className="min-w-0">
                    <CardHeader>
                      <CardTitle>{t("detail.bidActivity")}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {!online && bids.data ? (
                        <p role="status" className="mb-3 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                          {t("detail.offlineBidsCached", { time: formatDateTime(new Date(bids.dataUpdatedAt).toISOString()) })}
                        </p>
                      ) : null}
                      {(bids.data?.items ?? []).length === 0 ? (
                        <EmptyState size="inline" icon={Gavel} title={t("detail.noBids")} />
                      ) : (
                        <ul className="max-h-96 divide-y overflow-y-auto text-sm">
                          {bids.data?.items.map((bid) => (
                            <li key={bid.id} className="flex items-center justify-between gap-4 py-2.5">
                              <span className="flex flex-wrap items-center gap-2">
                                <span className="font-medium tabular-nums">
                                  {bid.amount === null ? t("detail.sealedBid") : formatMoney(bid.amount)}
                                </span>
                                {bid.bidderId === session?.user.id ? <Badge>{t("detail.yours")}</Badge> : null}
                                {bid.status !== "active" ? (
                                  <Badge variant="muted">{statusLabel(bid.status)}</Badge>
                                ) : null}
                              </span>
                              <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(bid.placedAt)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : null}

              {isBidder && DISPUTABLE.has(record.status) ? (
                <div className="flex flex-col gap-3 rounded-lg border border-dashed p-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">{t("detail.disputePrompt")}</p>
                  <OpenDisputeButton auctionId={record.id} />
                </div>
              ) : null}
            </div>

            {hasAside ? (
              <aside
                className="order-1 min-w-0 space-y-6 lg:sticky lg:top-32 lg:order-2"
                aria-label={t("detail.takePart")}
              >
                {canParticipate ? <Participation auction={record} online={online} /> : null}
                {showSignInCard ? (
                  <Card className="border-primary/30">
                    <CardHeader>
                      <CardTitle>{t("detail.takePartTitle")}</CardTitle>
                      <CardDescription>{t("detail.takePartBody")}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2">
                      <Button asChild>
                        <Link to="/register">{t("detail.createAccount")}</Link>
                      </Button>
                      <Button asChild variant="outline">
                        <Link to="/login" state={{ from: `/auctions/${record.id}` }}>
                          {t("detail.signIn")}
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                ) : null}
                {showWatchlist ? <WatchlistControls auction={record} /> : null}
              </aside>
            ) : null}
          </div>

          <AuctionTransparencyPanel auctionId={record.id} status={record.status} />
        </div>
      ) : null}
    </QueryState>
  );
}

function KeyFacts({ auction }: { auction: Auction }) {
  const t = useT("auctions");
  const sealedHidden = auction.auctionType === "sealed_bid" && !auction.sealedOpenedAt;
  const facts = [
    {
      label: auction.auctionType === "sealed_bid" ? t("detail.reserveBasis") : t("detail.startPrice"),
      value: formatMoney(auction.startPrice),
    },
    {
      label: t("detail.highestBid"),
      value: sealedHidden
        ? t("detail.sealed")
        : Number(auction.currentHighestBid ?? 0) > 0
          ? formatMoney(auction.currentHighestBid)
          : t("detail.noBidsYet"),
    },
    { label: t("detail.bids"), value: String(auction.bidCount) },
    {
      label: auction.status === "scheduled" ? t("detail.opens") : t("detail.closes"),
      value: formatDateTime(auction.status === "scheduled" ? auction.opensAt : auction.closesAt),
    },
  ];
  // gap-px over a border-coloured background draws clean dividers at every breakpoint without per-cell border logic.
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border shadow-xs lg:grid-cols-4">
      {facts.map((fact) => (
        <div key={fact.label} className="min-w-0 bg-card p-4 sm:p-5">
          <dt className="eyebrow text-muted-foreground">{fact.label}</dt>
          <dd className="mt-1.5 break-words text-lg font-semibold tracking-tight tabular-nums sm:text-xl">
            {fact.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Participation({ auction, online }: { auction: Auction; online: boolean }) {
  const readiness = useBidderReadiness(auction);
  const t = useT("auctions");
  const open = auction.status === "live";
  const upcoming = auction.status === "scheduled";
  if (!open && !upcoming) return null;
  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle>{open ? t("detail.placeBid") : t("detail.getReady")}</CardTitle>
        {readiness.ready ? null : (
          <CardDescription>{t("detail.stepsFirst")}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="@container space-y-6">
        {readiness.ready ? null : <BidderReadinessPanel auction={auction} readiness={readiness} />}
        {open ? (
          <BidForm auction={auction} disabled={!online || (!readiness.ready && !readiness.loading)} />
        ) : (
          <p className="text-sm text-muted-foreground">{t("detail.opensOn", { date: formatDateTime(auction.opensAt) })}</p>
        )}
      </CardContent>
    </Card>
  );
}