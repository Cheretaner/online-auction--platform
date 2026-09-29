import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import auctionGavelIcon from '../../assets/icons/auction-gavel.svg'
import awardedCheckIcon from '../../assets/icons/awarded-check.svg'
import bondIcon from '../../assets/icons/bond.svg'
import issuerVerifiedIcon from '../../assets/icons/issuer-verified.svg'
import locationIcon from '../../assets/icons/location.svg'
import sealedLockIcon from '../../assets/icons/sealed-lock.svg'
import timerIcon from '../../assets/icons/timer.svg'
import type { Auction } from '@/lib/api/types'
import { formatDateTime, formatMoney } from '@/lib/format'
import { Icon } from '../ui/Icon'

const buttonBase =
  'flex shrink-0 items-center justify-center font-label text-label-12 font-medium text-center uppercase'

const standardCard = 'border border-line bg-card drop-shadow-panel'
const cardHeader = 'flex flex-col gap-[8px] border-b border-line/60 pb-[4px]'
const cardFooter = 'border-t border-line/60 pt-[4px]'
const headline = 'font-display text-xl font-medium tracking-[-0.5px] text-ink'
const price = 'font-display text-xl font-semibold tracking-[-0.5px] whitespace-nowrap text-ink text-right'
const monoLabel = 'font-label text-label-11 font-medium text-ink-soft'
const summaryBox = 'flex flex-col justify-between self-start border border-line bg-panel p-[12px]'

function Card({ className, children }: { className: string; children: ReactNode }) {
  return (
    <article className={`w-full ${className}`}>
      <div className="flex flex-col gap-[12px] p-[20px]">{children}</div>
    </article>
  )
}

function ReferenceChip({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span className={`px-[8px] py-[2px] font-label text-xs font-medium tracking-[0.3px] whitespace-nowrap ${className}`}>
      {children}
    </span>
  )
}

function Issuer({ name, className = 'text-ink' }: { name: string; className?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-[4px]">
      <span className={`truncate text-body-13 font-semibold ${className}`}>{name}</span>
      <Icon src={issuerVerifiedIcon} width={14.4} height={13.6} />
    </div>
  )
}

function Location({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-[4px]">
      <Icon src={locationIcon} width={9.1} height={11.2} />
      <span className="font-label text-label-11 font-medium whitespace-nowrap text-ink-soft">{children}</span>
    </div>
  )
}

/** "Ending in 4h 12m" from the auction's current close time. */
function timeLeft(closesAt: string, now = Date.now()): string {
  const ms = new Date(closesAt).getTime() - now
  if (ms <= 0) return 'Closing now'
  const minutes = Math.floor(ms / 60_000)
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  if (days > 0) return `Ending in ${days}d ${hours}h`
  return `Ending in ${hours}h ${minutes % 60}m`
}

function reference(auction: Auction): string {
  const year = new Date(auction.createdAt).getFullYear()
  return `TND-${year}-${auction.id.slice(0, 6).toUpperCase()}`
}

function StatusChips({ auction }: { auction: Auction }) {
  if (auction.status === 'live') {
    return (
      <div className="flex flex-wrap items-center gap-[4px]">
        <span className="flex items-center gap-[6px] border border-forest bg-forest/10 px-[10px] py-[2px]">
          <span className="size-[6px] rounded-full bg-forest" />
          <span className="font-label text-label-11 font-semibold whitespace-nowrap text-forest uppercase">
            {auction.auctionType === 'sealed_bid' ? 'Sealed · Open' : 'Live Auction'}
          </span>
        </span>
        <span className="flex items-center gap-[4px] border border-danger/30 bg-danger-tint/40 px-[8px] py-[2px]">
          <Icon src={timerIcon} width={9.1} height={10.725} />
          <span className="font-label text-xs font-medium whitespace-nowrap text-danger">{timeLeft(auction.closesAt)}</span>
        </span>
      </div>
    )
  }
  if (auction.status === 'awarded') {
    return (
      <span className="flex w-fit items-center gap-[6px] bg-panel-4 px-[10px] py-[2px]">
        <Icon src={awardedCheckIcon} width={11.2} height={11.2} />
        <span className="font-label text-label-11 font-semibold whitespace-nowrap text-ink-strong uppercase">
          Completed &amp; Awarded
        </span>
      </span>
    )
  }
  const label =
    auction.status === 'scheduled'
      ? `Opens ${formatDateTime(auction.opensAt)}`
      : auction.status === 'under_review'
        ? 'Closed · Under review'
        : `Closed ${formatDateTime(auction.closedAt ?? auction.closesAt)}`
  return (
    <div className="flex flex-wrap items-center gap-[4px]">
      {auction.auctionType === 'sealed_bid' ? (
        <span className="flex items-center gap-[4px] bg-navy px-[10px] py-[2px]">
          <Icon src={sealedLockIcon} width={7.8} height={11.05} />
          <span className="font-label text-label-11 font-semibold whitespace-nowrap text-sidebar-foreground uppercase">Sealed Tender</span>
        </span>
      ) : null}
      <span className="border border-line bg-panel-2 px-[8px] py-[2px] font-label text-xs whitespace-nowrap text-ink-soft">
        {label}
      </span>
    </div>
  )
}

function PriceSummary({ auction }: { auction: Auction }) {
  const sealedHidden = auction.auctionType === 'sealed_bid' && !auction.sealedOpenedAt
  let caption: string
  let amount: string
  if (auction.status === 'awarded' && auction.winningAmount) {
    caption = 'Final Sale Price'
    amount = formatMoney(auction.winningAmount)
  } else if (auction.currentHighestBid && Number(auction.currentHighestBid) > 0 && !sealedHidden) {
    caption = 'Current Highest Bid'
    amount = formatMoney(auction.currentHighestBid)
  } else {
    caption = sealedHidden ? 'Indicative Base Value' : 'Starting Price'
    amount = formatMoney(auction.startPrice)
  }
  return (
    <div className={`col-span-12 md:col-span-5 ${summaryBox}`}>
      <div className="flex flex-col items-end">
        <span className={`${monoLabel} text-right uppercase`}>{caption}</span>
        <span className={price}>{amount}</span>
        <span className={`${monoLabel} pt-[2px] text-right`}>
          {auction.bidCount} {auction.bidCount === 1 ? 'bid' : 'bids'}
          {auction.auctionType === 'open_ascending' ? ` · increment ${formatMoney(auction.minIncrement)}` : ''}
        </span>
      </div>
    </div>
  )
}

function AuctionListing({ auction, issuer, featured }: { auction: Auction; issuer: string; featured: boolean }) {
  const cardClass = featured
    ? 'border-2 border-primary bg-card drop-shadow-panel'
    : auction.status === 'awarded' || auction.status === 'closed'
      ? 'border border-line bg-panel/70'
      : standardCard
  const cta =
    auction.status === 'live'
      ? auction.auctionType === 'sealed_bid'
        ? 'Review & Submit Sealed Bid'
        : 'View Auction & Bid'
      : auction.status === 'scheduled'
        ? 'Prepare to Bid'
        : 'View Results'

  return (
    <Card className={cardClass}>
      <div className={cardHeader}>
        <div className="flex flex-wrap items-center gap-x-[12px] gap-y-1">
          <ReferenceChip className="bg-panel-3 text-ink">{reference(auction)}</ReferenceChip>
          <Issuer name={issuer} />
          {auction.region ? (
            <>
              <span className="text-sm text-line">|</span>
              <Location>{auction.region}</Location>
            </>
          ) : null}
        </div>
        <StatusChips auction={auction} />
      </div>

      <div className="grid grid-cols-12 gap-[12px]">
        <div className="col-span-12 flex min-w-0 flex-col gap-[4px] self-start md:col-span-7">
          <h2 className={headline}>{auction.title}</h2>
          {auction.description ? (
            <p className="line-clamp-3 text-body-13 leading-[1.625] text-ink-soft">{auction.description}</p>
          ) : null}
          <div className={`flex flex-wrap items-center gap-x-[12px] gap-y-1 pt-[4px] ${monoLabel}`}>
            <p>
              FORMAT: <strong className="font-bold">{auction.auctionType === 'sealed_bid' ? 'SEALED BID' : 'OPEN ASCENDING'}</strong>
            </p>
            <p>
              CLOSES: <strong className="font-bold">{formatDateTime(auction.closesAt).toUpperCase()}</strong>
            </p>
          </div>
        </div>
        <PriceSummary auction={auction} />
      </div>

      <div className={`flex flex-col gap-[8px] sm:flex-row sm:items-center sm:justify-between ${cardFooter}`}>
        <div className="flex items-center gap-[6px]">
          <Icon src={bondIcon} width={12.8} height={12.8} />
          <p className="text-body-13 text-ink-soft">
            {Number(auction.depositAmount) > 0 ? (
              <>
                Required bid security: <span className="font-label font-bold text-ink">{formatMoney(auction.depositAmount)}</span>
              </>
            ) : (
              'No bid security required'
            )}
          </p>
        </div>
        <Link to={`/auctions/${auction.id}`} className={`${buttonBase} gap-[6px] bg-primary px-[20px] py-[6px] text-primary-foreground hover:bg-primary/90`}>
          <Icon src={auctionGavelIcon} width={11.2} height={12} />
          {cta}
        </Link>
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
  footer,
}: {
  auctions: Auction[]
  issuerName: (orgId: string) => string
  loading: boolean
  error: string | null
  onRetry: () => void
  footer?: ReactNode
}) {
  let body: ReactNode
  if (loading) {
    body = Array.from({ length: 3 }, (_, index) => (
      <div key={index} className={`h-[220px] animate-pulse ${standardCard}`} aria-hidden />
    ))
  } else if (error) {
    body = (
      <div className={`${standardCard} flex flex-col items-start gap-2 p-[20px]`}>
        <p className="text-body-13 text-danger">{error}</p>
        <button type="button" onClick={onRetry} className={`${buttonBase} border border-primary px-[12px] py-[6px] text-primary`}>
          Try again
        </button>
      </div>
    )
  } else if (auctions.length === 0) {
    body = (
      <div className={`${standardCard} p-[20px]`}>
        <p className="font-display text-xl text-ink">No auctions match these filters</p>
        <p className="text-body-13 text-ink-soft">Try another status, region or search term.</p>
      </div>
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
    <section className="col-span-12 flex flex-col gap-[12px] lg:col-span-8" aria-live="polite">
      {body}
      {footer}
    </section>
  )
}
