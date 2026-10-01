import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BadgeCheck, CircleCheck, Gavel, Lock, MapPin, SearchX, ShieldCheck, Timer } from 'lucide-react'
import { EmptyState, ErrorState } from '@/components/feedback/query-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { Auction } from '@/lib/api/types'
import { formatDateTime, formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'

/** "Ending in 4h 12m" from the auction's current close time. */
function timeLeft(closesAt: string, now = Date.now()): string {
  const ms = new Date(closesAt).getTime() - now
  if (ms <= 0) return 'Closing now'
  const minutes = Math.floor(ms / 60_000)
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  if (days > 0) return `Ends in ${days}d ${hours}h`
  return `Ends in ${hours}h ${minutes % 60}m`
}

function reference(auction: Auction): string {
  const year = new Date(auction.createdAt).getFullYear()
  return `TND-${year}-${auction.id.slice(0, 6).toUpperCase()}`
}

function StatusChips({ auction }: { auction: Auction }) {
  const sealed = auction.auctionType === 'sealed_bid'
  if (auction.status === 'live') {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="default">
          <span className="size-1.5 animate-pulse rounded-full bg-current" aria-hidden />
          {sealed ? 'Sealed bids open' : 'Live auction'}
        </Badge>
        <Badge variant="warning">
          <Timer aria-hidden />
          {timeLeft(auction.closesAt)}
        </Badge>
      </div>
    )
  }
  if (auction.status === 'awarded') {
    return (
      <Badge variant="success">
        <CircleCheck aria-hidden />
        Completed &amp; awarded
      </Badge>
    )
  }
  const label =
    auction.status === 'scheduled'
      ? `Opens ${formatDateTime(auction.opensAt)}`
      : auction.status === 'under_review'
        ? 'Closed · under review'
        : `Closed ${formatDateTime(auction.closedAt ?? auction.closesAt)}`
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {sealed ? (
        <Badge variant="secondary">
          <Lock aria-hidden />
          Sealed tender
        </Badge>
      ) : null}
      <Badge variant={auction.status === 'scheduled' ? 'info' : 'muted'}>{label}</Badge>
    </div>
  )
}

function PriceSummary({ auction }: { auction: Auction }) {
  const sealedHidden = auction.auctionType === 'sealed_bid' && !auction.sealedOpenedAt
  let caption: string
  let amount: string
  if (auction.status === 'awarded' && auction.winningAmount) {
    caption = 'Final sale price'
    amount = formatMoney(auction.winningAmount)
  } else if (auction.currentHighestBid && Number(auction.currentHighestBid) > 0 && !sealedHidden) {
    caption = 'Current highest bid'
    amount = formatMoney(auction.currentHighestBid)
  } else {
    caption = sealedHidden ? 'Indicative base value' : 'Starting price'
    amount = formatMoney(auction.startPrice)
  }
  return (
    <div className="rounded-md bg-muted/70 p-4 md:text-right">
      <p className="eyebrow text-muted-foreground">{caption}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight tabular-nums">{amount}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {auction.bidCount} {auction.bidCount === 1 ? 'bid' : 'bids'}
        {auction.auctionType === 'open_ascending' ? ` · increment ${formatMoney(auction.minIncrement)}` : ''}
      </p>
    </div>
  )
}

function AuctionListing({ auction, issuer, featured }: { auction: Auction; issuer: string; featured: boolean }) {
  const finished = auction.status === 'awarded' || auction.status === 'closed'
  const cta =
    auction.status === 'live'
      ? auction.auctionType === 'sealed_bid'
        ? 'Review & submit sealed bid'
        : 'View auction & bid'
      : auction.status === 'scheduled'
        ? 'Prepare to bid'
        : 'View results'

  return (
    <Card
      className={cn('flex flex-col gap-4 p-5', featured && 'border-primary/50 ring-1 ring-primary/30', finished && 'bg-card/70')}
    >
      <div className="flex flex-col gap-3 border-b pb-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
          <span className="rounded-sm bg-secondary px-2 py-0.5 font-mono text-xs text-secondary-foreground">
            {reference(auction)}
          </span>
          <span className="inline-flex min-w-0 items-center gap-1 font-medium">
            <span className="truncate">{issuer}</span>
            <BadgeCheck className="size-4 shrink-0 text-primary" aria-label="Verified issuer" />
          </span>
          {auction.region ? (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <MapPin className="size-3.5" aria-hidden />
              {auction.region}
            </span>
          ) : null}
        </div>
        <StatusChips auction={auction} />
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_minmax(0,15rem)]">
        <div className="min-w-0 space-y-2">
          <h2 className="text-xl leading-snug font-semibold">
            <Link to={`/auctions/${auction.id}`} className="rounded-sm hover:text-primary">
              {auction.title}
            </Link>
          </h2>
          {auction.description ? (
            <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">{auction.description}</p>
          ) : null}
          <dl className="flex flex-wrap gap-x-5 gap-y-1 pt-1 text-xs">
            <div className="flex gap-1.5">
              <dt className="text-muted-foreground">Format</dt>
              <dd className="font-medium">{auction.auctionType === 'sealed_bid' ? 'Sealed bid' : 'Open ascending'}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="text-muted-foreground">Closes</dt>
              <dd className="font-medium">{formatDateTime(auction.closesAt)}</dd>
            </div>
          </dl>
        </div>
        <PriceSummary auction={auction} />
      </div>

      <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="size-4 shrink-0" aria-hidden />
          {Number(auction.depositAmount) > 0 ? (
            <span>
              Bid security:{' '}
              <span className="font-medium text-foreground tabular-nums">{formatMoney(auction.depositAmount)}</span>
            </span>
          ) : (
            'No bid security required'
          )}
        </p>
        <Button asChild variant={finished ? 'outline' : 'default'} className="w-full sm:w-auto">
          <Link to={`/auctions/${auction.id}`}>
            <Gavel aria-hidden />
            {cta}
          </Link>
        </Button>
      </div>
    </Card>
  )
}

export function ListingFeed({
  auctions,
  issuerName,
  loading,
  error,
  onRetry,
  onClearFilters,
  footer,
}: {
  auctions: Auction[]
  issuerName: (orgId: string) => string
  loading: boolean
  error: unknown
  onRetry: () => void
  onClearFilters?: () => void
  footer?: ReactNode
}) {
  let body: ReactNode
  if (loading) {
    body = Array.from({ length: 3 }, (_, index) => (
      <Card key={index} className="space-y-4 p-5" aria-hidden>
        <Skeleton className="h-5 w-2/5" />
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-10 w-full" />
      </Card>
    ))
  } else if (error) {
    body = <ErrorState error={error} onRetry={onRetry} />
  } else if (auctions.length === 0) {
    body = (
      <EmptyState
        icon={SearchX}
        title="No auctions match these filters"
        description="Try another status, region or search term."
        action={
          onClearFilters ? (
            <Button variant="outline" onClick={onClearFilters}>
              Clear all filters
            </Button>
          ) : null
        }
      />
    )
  } else {
    body = auctions.map((auction, index) => (
      <AuctionListing
        key={auction.id}
        auction={auction}
        issuer={issuerName(auction.orgId)}
        featured={index === 0 && auction.status === 'live'}
      />
    ))
  }

  return (
    <section className="flex min-w-0 flex-col gap-4" aria-label="Auction results" aria-busy={loading}>
      {body}
      {footer}
    </section>
  )
}
