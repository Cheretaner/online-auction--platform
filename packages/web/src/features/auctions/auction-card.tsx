import { ArrowUpRight, CalendarClock, Gavel, Lock, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import type { Auction } from "@/lib/api/types";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/feedback/status-badge";
import { formatDateTime, formatMoney, regionLabel } from "@/lib/format";
import { useT } from "@/i18n/context";

/** Compact auction summary for grids. The whole card is one link target. */
export function AuctionCard({ auction }: { auction: Auction }) {
  const t = useT("auctions");
  const tc = useT("common");
  const sealed = auction.auctionType === "sealed_bid";
  const sealedHidden = sealed && !auction.sealedOpenedAt;
  const hasBid = Number(auction.currentHighestBid ?? 0) > 0 && !sealedHidden;
  const priceLabel = hasBid ? t("card.currentBid") : sealedHidden ? t("card.indicativeBase") : t("card.startingPrice");

  return (
    <Card interactive className="group relative flex h-full flex-col p-5">
      <div className="flex items-center justify-between gap-3">
        <StatusBadge status={auction.status} />
        <span className="eyebrow inline-flex items-center gap-1 text-muted-foreground">
          {sealed ? <Lock className="size-3" aria-hidden /> : null}
          {sealed ? t("card.sealed") : t("card.open")}
        </span>
      </div>

      <h3 className="mt-4 text-xl leading-snug font-semibold">
        <Link
          to={`/auctions/${auction.id}`}
          className="rounded-sm after:absolute after:inset-0 after:rounded-lg group-hover:text-primary"
        >
          {auction.title}
        </Link>
      </h3>
      <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
        {auction.description || t("card.fallback")}
      </p>

      <div className="mt-5 rounded-md bg-muted/70 px-4 py-3">
        <p className="eyebrow text-muted-foreground">{priceLabel}</p>
        <p className="mt-1 text-xl font-semibold tracking-tight tabular-nums">
          {formatMoney(hasBid ? auction.currentHighestBid : auction.startPrice)}
        </p>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
        <div className="flex min-w-0 items-center gap-2">
          <Gavel className="size-3.5 shrink-0" aria-hidden="true" />
          <dt className="sr-only">{t("card.bids")}</dt>
          <dd>{auction.bidCount === 1 ? tc("bidCountOne") : tc("bidCountOther", { count: auction.bidCount })}</dd>
        </div>
        {auction.region ? (
          <div className="flex min-w-0 items-center gap-2">
            <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
            <dt className="sr-only">{t("card.region")}</dt>
            <dd className="truncate">{regionLabel(auction.region)}</dd>
          </div>
        ) : null}
        <div className="col-span-2 flex min-w-0 items-center gap-2">
          <CalendarClock className="size-3.5 shrink-0" aria-hidden="true" />
          <dt className="sr-only">{t("card.closes")}</dt>
          <dd className="truncate">{t("card.closesOn", { date: formatDateTime(auction.closesAt) })}</dd>
        </div>
      </dl>

      <div className="mt-auto pt-5">
        <div className="flex items-center justify-between border-t pt-4 text-sm font-medium text-primary" aria-hidden>
          <span>{t("card.view")}</span>
          <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </div>
      </div>
    </Card>
  );
}
