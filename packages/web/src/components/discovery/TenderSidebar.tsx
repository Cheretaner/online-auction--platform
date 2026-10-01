import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BadgeCheck, Download, FileText, Gavel, LifeBuoy, MapPin, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/auth-provider'
import { useAuctionDocuments } from '@/features/operations/queries'
import { getErrorMessage } from '@/lib/api/errors'
import type { Auction } from '@/lib/api/types'
import { downloadDocument } from '@/lib/download'
import { formatDateTime, formatMoney } from '@/lib/format'

const steps = [
  'Create an account and verify your identity once. Verification covers every auction on the platform.',
  'Register the bid security (CPO or bank guarantee) the auction asks for, with a scan of the instrument.',
  'Once the organization verifies your deposit, bid while the auction is live. Sealed bids stay hidden until opening.',
]

function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="eyebrow mb-2 text-muted-foreground">{children}</h3>
}

function Documents({ auctionId }: { auctionId: string }) {
  const { isAuthenticated } = useAuth()
  const docs = useAuctionDocuments(auctionId, isAuthenticated)
  if (!isAuthenticated) {
    return (
      <p className="text-sm text-muted-foreground">
        <Link to="/login" state={{ from: '/auctions' }} className="font-medium text-primary underline-offset-4 hover:underline">
          Sign in
        </Link>{' '}
        to download the tender documents.
      </p>
    )
  }
  const items = docs.data?.items ?? []
  if (docs.isLoading) return <Skeleton className="h-12 w-full" />
  if (items.length === 0) return <p className="text-sm text-muted-foreground">No documents published yet.</p>
  return (
    <ul className="flex flex-col gap-2">
      {items.map((doc) => (
        <li key={doc.id}>
          <button
            type="button"
            onClick={() =>
              downloadDocument(doc.id, doc.fileName).catch((error: unknown) =>
                toast.error(getErrorMessage(error, 'Download failed')),
              )
            }
            className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-md border bg-background p-2.5 text-left transition-colors hover:border-primary/40 hover:bg-muted"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium">{doc.fileName}</span>
                <span className="text-xs text-muted-foreground capitalize">
                  {doc.documentType.replaceAll('_', ' ')} · {(doc.fileSizeBytes / 1024).toFixed(0)} KB
                </span>
              </span>
            </span>
            <Download className="size-4 shrink-0 text-muted-foreground" aria-label="Download" />
          </button>
        </li>
      ))}
    </ul>
  )
}

function Highlight({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 text-sm">
      <dt className="inline-flex items-center gap-2 text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  )
}

/** Summary of the highlighted auction (the first result) plus how to take
 * part. Everything shown comes from the API. */
export function TenderSidebar({ auction, issuer }: { auction: Auction | undefined; issuer: string }) {
  return (
    <aside className="flex flex-col gap-4 lg:sticky lg:top-32" aria-label="Tender overview and guidance">
      {auction ? (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b bg-muted/60 px-5 py-3">
            <p className="eyebrow text-foreground">Tender overview</p>
            <Badge variant="solid">Top result</Badge>
          </div>
          <div className="flex flex-col gap-5 p-5">
            <div>
              <h2 className="text-xl leading-snug font-semibold">{auction.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {issuer} · closes {formatDateTime(auction.closesAt)}
              </p>
            </div>

            <div>
              <SectionTitle>Essentials</SectionTitle>
              <dl className="divide-y rounded-md border px-3">
                <Highlight icon={<BadgeCheck className="size-4" aria-hidden />} label="Issuer" value={issuer} />
                <Highlight
                  icon={<ShieldCheck className="size-4" aria-hidden />}
                  label="Bid security"
                  value={Number(auction.depositAmount) > 0 ? formatMoney(auction.depositAmount) : 'None'}
                />
                <Highlight
                  icon={<MapPin className="size-4" aria-hidden />}
                  label="Region"
                  value={auction.region ?? 'Not specified'}
                />
              </dl>
            </div>

            <div>
              <SectionTitle>Tender documents</SectionTitle>
              <Documents auctionId={auction.id} />
            </div>

            <Button asChild className="w-full">
              <Link to={`/auctions/${auction.id}`}>
                <Gavel aria-hidden /> Open auction
              </Link>
            </Button>
          </div>
        </Card>
      ) : null}

      <Card id="how-to-participate" className="p-5">
        <h2 className="text-lg font-semibold">How to participate</h2>
        <ol className="mt-4 flex flex-col gap-4">
          {steps.map((step, index) => (
            <li key={step} className="flex items-start gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 font-mono text-xs font-semibold text-primary">
                {index + 1}
              </span>
              <p className="text-sm leading-6 text-muted-foreground">{step}</p>
            </li>
          ))}
        </ol>
      </Card>

      <div className="rounded-lg border border-dashed p-5">
        <p className="inline-flex items-center gap-2 text-sm font-semibold">
          <LifeBuoy className="size-4 text-primary" aria-hidden />
          Need assistance?
        </p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Questions about a specific tender go to the issuing organization named on it. If you believe an auction was run
          unfairly, raise a dispute from the auction page; every step is recorded in the audit trail.
        </p>
      </div>
    </aside>
  )
}
