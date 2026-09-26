import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import bidSecurityIcon from '../../assets/icons/bid-security.svg'
import docSpecificationIcon from '../../assets/icons/doc-specification.svg'
import downloadArrowIcon from '../../assets/icons/download-arrow.svg'
import helpDeskIcon from '../../assets/icons/help-desk.svg'
import inspectionSiteIcon from '../../assets/icons/inspection-site.svg'
import sellerVerifiedIcon from '../../assets/icons/seller-verified.svg'
import submitBidIcon from '../../assets/icons/submit-bid.svg'
import tenderOverviewIcon from '../../assets/icons/tender-overview.svg'
import { useAuth } from '@/features/auth/auth-provider'
import { useAuctionDocuments } from '@/features/operations/queries'
import { getErrorMessage } from '@/lib/api/errors'
import type { Auction } from '@/lib/api/types'
import { downloadDocument } from '@/lib/download'
import { formatDateTime, formatMoney } from '@/lib/format'
import { Icon } from '../ui/Icon'

const sectionHeading = 'font-label text-label-11 font-semibold text-ink uppercase'
const insetBox = 'flex flex-col border border-line bg-panel p-[12px]'

const steps = [
  'Create an account and verify your identity once. Verification covers every auction on the platform.',
  'Register the bid security (CPO or bank guarantee) the auction asks for, with a scan of the instrument.',
  'Once the organization verifies your deposit, bid while the auction is live. Sealed bids stay hidden until opening.',
]

function Section({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <div id={id} className="flex flex-col gap-[4px]">
      <h4 className={sectionHeading}>{title}</h4>
      {children}
    </div>
  )
}

function Documents({ auctionId }: { auctionId: string }) {
  const { isAuthenticated } = useAuth()
  const docs = useAuctionDocuments(auctionId, isAuthenticated)
  if (!isAuthenticated) {
    return (
      <p className="text-body-13 text-ink-soft">
        <Link to="/login" className="text-ink underline">
          Sign in
        </Link>{' '}
        to download the tender documents.
      </p>
    )
  }
  const items = docs.data?.items ?? []
  if (docs.isLoading) return <p className="text-body-13 text-ink-soft">Loading documents…</p>
  if (items.length === 0) return <p className="text-body-13 text-ink-soft">No documents published yet.</p>
  return (
    <div className="flex flex-col gap-[8px]">
      {items.map((doc) => (
        <button
          key={doc.id}
          type="button"
          onClick={() =>
            downloadDocument(doc.id, doc.fileName).catch((error: unknown) =>
              toast.error(getErrorMessage(error, 'Download failed')),
            )
          }
          className="flex items-center justify-between gap-2 border border-line bg-canvas p-[8px] text-left"
        >
          <div className="flex min-w-0 items-center gap-[8px]">
            <Icon src={docSpecificationIcon} width={16} height={16} />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-body-13 font-medium text-ink">{doc.fileName}</span>
              <span className="font-label text-[11px] leading-5 text-ink-soft">
                {doc.documentType.replaceAll('_', ' ')} · {(doc.fileSizeBytes / 1024).toFixed(0)} KB
              </span>
            </div>
          </div>
          <Icon src={downloadArrowIcon} width={10.8} height={11.7} />
        </button>
      ))}
    </div>
  )
}

/** Summary of the highlighted auction (the first result) plus how to take
 * part. Everything shown comes from the API. */
export function TenderSidebar({ auction, issuer }: { auction: Auction | undefined; issuer: string }) {
  return (
    <aside className="col-span-12 flex flex-col gap-[12px] self-start lg:col-span-4">
      {auction ? (
        <>
          <div className="flex items-center justify-between border border-line bg-panel p-[12px]">
            <div className="flex items-center gap-[8px]">
              <Icon src={tenderOverviewIcon} width={14} height={15.5} />
              <h3 className="font-label text-xs font-semibold tracking-[0.6px] whitespace-nowrap text-ink uppercase">
                Tender Overview
              </h3>
            </div>
            <span className="bg-ink px-[8px] py-[2px] font-label text-xs font-medium whitespace-nowrap text-white">
              TOP RESULT
            </span>
          </div>

          <div className="flex flex-col gap-[20px] border border-line bg-white p-[20px] drop-shadow-panel">
            <div className="flex flex-col gap-[4px] border-b border-line pb-[12px]">
              <h3 className="font-display text-xl font-medium text-ink">{auction.title}</h3>
              <p className="text-body-13 text-ink-soft">
                {issuer} · closes {formatDateTime(auction.closesAt)}
              </p>
            </div>

            <div className="flex flex-col gap-[8px]">
              <h4 className={sectionHeading}>Essential Highlights</h4>
              <div className={`${insetBox} gap-[3.5px]`}>
                <Highlight icon={sellerVerifiedIcon} size={[13.5, 12.75]} label="Issuer:" value={issuer} />
                <Highlight
                  icon={bidSecurityIcon}
                  size={[12, 12]}
                  label="Bid security:"
                  value={Number(auction.depositAmount) > 0 ? formatMoney(auction.depositAmount) : 'None'}
                  mono
                />
                <Highlight
                  icon={inspectionSiteIcon}
                  size={[10.5, 11.25]}
                  label="Region:"
                  value={auction.region ?? 'Not specified'}
                />
              </div>
            </div>

            <Section title="Official Tender Documents">
              <Documents auctionId={auction.id} />
            </Section>

            <div className="flex flex-col gap-[8px] border-t border-line pt-[4px]">
              <Link
                to={`/auctions/${auction.id}`}
                className="flex items-center justify-center gap-[8px] border border-ink bg-ink py-[10px] font-label text-label-12 font-medium whitespace-nowrap text-white uppercase"
              >
                <Icon src={submitBidIcon} width={12.6} height={13.5} />
                Open Auction
              </Link>
            </div>
          </div>
        </>
      ) : null}

      <div className="border border-line bg-white p-[20px] drop-shadow-panel">
        <Section id="how-to-participate" title="How to Participate">
          <ol className={`${insetBox} gap-[6px]`}>
            {steps.map((step, index) => (
              <li key={step} className="flex items-start gap-[7.99px]">
                <span className="font-label text-xs font-bold text-ink">{index + 1}.</span>
                <p className="min-w-0 flex-1 text-body-13 text-ink-soft">{step}</p>
              </li>
            ))}
          </ol>
        </Section>
      </div>

      <div className={`${insetBox} gap-[8px]`}>
        <div className="flex items-center gap-[6px]">
          <Icon src={helpDeskIcon} width={14.4} height={12.6} />
          <span className="text-sm font-semibold whitespace-nowrap text-ink">Need Assistance?</span>
        </div>
        <p className="text-body-13 text-ink-soft">
          Questions about a specific tender go to the issuing organization named on it. If you believe an auction was run
          unfairly, raise a dispute from the auction page; every step is recorded in the audit trail.
        </p>
      </div>
    </aside>
  )
}

function Highlight({
  icon,
  size,
  label,
  value,
  mono = false,
}: {
  icon: string
  size: [number, number]
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="flex items-center gap-[6px]">
        <Icon src={icon} width={size[0]} height={size[1]} />
        <span className="text-body-13 whitespace-nowrap text-ink-soft">{label}</span>
      </div>
      <span className={`text-right text-body-13 font-medium text-ink ${mono ? 'font-label' : ''}`}>{value}</span>
    </div>
  )
}
