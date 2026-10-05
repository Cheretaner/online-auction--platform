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
import { translate, useT } from '@/i18n/context'
import { enumLabel, regionLabel } from '@/lib/format'

/** "Ending in 4h 12m" from the auction's current close time. */
function timeLeft(closesAt: string, now = Date.now()): string {
  const ms = new Date(closesAt).getTime() - now
  if (ms <= 0) return translate('auctions', 'listing.closingNow')
  const minutes = Math.floor(ms / 60_000)
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  if (days > 0) return translate('auctions', 'listing.endsDays', { days, hours })
  return translate('auctions', 'listing.endsHours', { hours, minutes: minutes % 60 })
}

function reference(auction: Auction): string {
  const year = new Date(auction.createdAt).getFullYear()
  return `TND-${year}-${auction.id.slice(0, 6).toUpperCase()}`
}

function StatusChips({ auction }: { auction: Auction }) {
  const t = useT('auctions')
  const sealed = auction.auctionType === 'sealed_bid'
  if (auction.status === 'live') {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="default">
          <span className="size-1.5 animate-pulse rounded-full bg-current" aria-hidden />
          {sealed ? t('listing.sealedOpen') : t('listing.liveAuction')}
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
        {t('listing.awarded')}
      </Badge>
    )
  }
  const label =
    auction.status === 'scheduled'
      ? t('listing.opens', { date: formatDateTime(auction.opensAt) })
      : auction.status === 'under_review'
        ? t('listing.underReview')
        : t('listing.closedOn', { date: formatDateTime(auction.closedAt ?? auction.closesAt) })
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {sealed ? (
        <Badge variant="secondary">
          <Lock aria-hidden />
          {t('listing.sealedTender')}
        </Badge>
      ) : null}
      <Badge variant={auction.status === 'scheduled' ? 'info' : 'muted'}>{label}</Badge>
    </div>
  )
}

function PriceSummary({ auction }: { auction: Auction }) {
  const t = useT('auctions')
  const tc = useT('common')
  const sealedHidden = auction.auctionType === 'sealed_bid' && !auction.sealedOpenedAt
  let caption: string
  let amount: string
  if (auction.status === 'awarded' && auction.winningAmount) {
    caption = t('listing.finalPrice')
    amount = formatMoney(auction.winningAmount)
  } else if (auction.currentHighestBid && Number(auction.currentHighestBid) > 0 && !sealedHidden) {
    caption = t('listing.currentHighest')
    amount = formatMoney(auction.currentHighestBid)
  } else {
    caption = sealedHidden ? t('listing.indicativeBase') : t('listing.startingPrice')
    amount = formatMoney(auction.startPrice)
  }
  return (
    <div className="flex flex-col justify-center rounded-lg border bg-primary/[0.04] p-4 md:items-end md:text-right">
      <p className="eyebrow text-muted-foreground">{caption}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{amount}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {auction.bidCount === 1 ? tc('bidCountOne') : tc('bidCountOther', { count: auction.bidCount })}
        {auction.auctionType === 'open_ascending'
          ? ` · ${t('listing.increment', { amount: formatMoney(auction.minIncrement) })}`
          : ''}
      </p>
    </div>
  )
}

function AuctionListing({ auction, issuer, featured }: { auction: Auction; issuer: string; featured: boolean }) {
  const t = useT('auctions')
  const finished = auction.status === 'awarded' || auction.status === 'closed'
  const cta =
    auction.status === 'live'
      ? auction.auctionType === 'sealed_bid'
        ? t('listing.ctaSealed')
        : t('listing.ctaLive')
      : auction.status === 'scheduled'
        ? t('listing.ctaUpcoming')
        : t('listing.ctaResults')

  return (
    <Card
      interactive
      className={cn(
        'group relative flex flex-col gap-4 overflow-hidden p-4 sm:p-5',
        featured && 'border-primary/45 shadow-sm',
        finished && 'bg-card/80',
      )}
    >
      {featured ? <span className="absolute inset-y-0 left-0 w-1 bg-primary" aria-hidden /> : null}
      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 text-sm">
          <span className="rounded-md bg-secondary px-2.5 py-1 font-mono text-xs font-medium text-secondary-foreground">
            {reference(auction)}
          </span>
          <span className="inline-flex min-w-0 items-center gap-1.5 font-medium">
            <span className="truncate">{issuer}</span>
            <BadgeCheck className="size-4 shrink-0 text-primary" aria-label={t('discovery.verifiedIssuer')} />
          </span>
          {auction.region ? (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <MapPin className="size-3.5" aria-hidden />
              {regionLabel(auction.region)}
            </span>
          ) : null}
        </div>
        <StatusChips auction={auction} />
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(13rem,15rem)] md:items-stretch">
        <div className="min-w-0 space-y-2.5">
          <h2 className="text-xl leading-snug font-semibold sm:text-2xl">
            <Link to={`/auctions/${auction.id}`} className="rounded-sm transition-colors hover:text-primary focus-visible:text-primary">
              {auction.title}
            </Link>
          </h2>
          {auction.description ? (
            <p className="line-clamp-3 max-w-3xl text-sm leading-6 text-muted-foreground">{auction.description}</p>
          ) : null}
          <dl className="flex flex-wrap gap-x-5 gap-y-2 pt-1 text-xs">
            <div className="flex flex-wrap gap-x-1.5">
              <dt className="text-muted-foreground">{t('listing.format')}</dt>
              <dd className="font-medium">{enumLabel(auction.auctionType)}</dd>
            </div>
            <div className="flex flex-wrap gap-x-1.5">
              <dt className="text-muted-foreground">{t('listing.closes')}</dt>
              <dd className="font-medium">{formatDateTime(auction.closesAt)}</dd>
            </div>
          </dl>
        </div>
        <PriceSummary auction={auction} />
      </div>

      <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden />
          {Number(auction.depositAmount) > 0 ? (
            <span>
              {t('listing.bidSecurity')}{' '}
              <span className="font-medium text-foreground tabular-nums">{formatMoney(auction.depositAmount)}</span>
            </span>
          ) : (
            t('listing.noBidSecurity')
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
  const t = useT('auctions')
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
        title={t('discovery.emptyTitle')}
        description={t('discovery.emptyBody')}
        action={
          onClearFilters ? (
            <Button variant="outline" onClick={onClearFilters}>
              {t('discovery.clearFilters')}
            </Button>
          ) : null
        }
      />
    )
  } else {
    body = (
      <div className="grid gap-4 sm:grid-cols-2">
        {auctions.map((auction, index) => {
          const featured = index === 0 && auction.status === 'live'
          return (
            <div key={auction.id} className={featured ? 'sm:col-span-2' : undefined}>
              <AuctionListing
                auction={auction}
                issuer={issuerName(auction.orgId)}
                featured={featured}
              />
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <section className="flex min-w-0 flex-col gap-4" aria-label={t('discovery.results')} aria-busy={loading}>
      {body}
      {footer}
    </section>
  )
}
