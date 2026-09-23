import type { ReactNode } from 'react'
import bidSecurityIcon from '../../assets/icons/bid-security.svg'
import docCertificateIcon from '../../assets/icons/doc-certificate.svg'
import docSpecificationIcon from '../../assets/icons/doc-specification.svg'
import downloadArrowIcon from '../../assets/icons/download-arrow.svg'
import escrowBankIcon from '../../assets/icons/escrow-bank.svg'
import helpDeskIcon from '../../assets/icons/help-desk.svg'
import inspectionSiteIcon from '../../assets/icons/inspection-site.svg'
import sellerVerifiedIcon from '../../assets/icons/seller-verified.svg'
import submitBidIcon from '../../assets/icons/submit-bid.svg'
import tenderOverviewIcon from '../../assets/icons/tender-overview.svg'
import { Icon } from '../ui/Icon'

const sectionHeading = 'font-label text-label-11 font-semibold text-ink uppercase'
const insetBox = 'flex flex-col border border-line bg-panel p-[12px]'

const highlights = [
  {
    icon: sellerVerifiedIcon,
    size: [13.5, 12.75],
    label: 'Verified Seller:',
    value: 'Ministry of Transport & Logistics',
    mono: false,
  },
  { icon: bidSecurityIcon, size: [12, 12], label: 'Bid Security (CPO):', value: '5% (ETB 9,410,000)', mono: true },
  { icon: escrowBankIcon, size: [11.25, 10.5], label: 'Escrow Bank:', value: 'Commercial Bank of Ethiopia', mono: false },
  {
    icon: inspectionSiteIcon,
    size: [10.5, 11.25],
    label: 'Inspection Site:',
    value: 'Bole Lemi Industrial Depot',
    mono: false,
  },
]

const steps = [
  "Deposit 5% CPO (Cashier's Payment Order) payable to Commercial Bank of Ethiopia in favor of the Ministry.",
  'Upload verified tax compliance & renewed business license on Cheretanet.',
  'Receive your official Digital Bidder Pass for real-time live bidding.',
]

const documents = [
  {
    icon: docSpecificationIcon,
    size: [16, 16],
    name: 'Tender_Specification_Package.pdf',
    meta: 'Official Directive & Terms · 4.2 MB',
  },
  {
    icon: docCertificateIcon,
    size: [16, 14],
    name: 'Mechanical_Inspection_Cert.pdf',
    meta: 'Technical Inspection Board · 1.8 MB',
  },
]

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-[4px]">
      <h4 className={sectionHeading}>{title}</h4>
      {children}
    </div>
  )
}

export function TenderSidebar() {
  return (
    <aside className="col-span-4 flex flex-col gap-[12px] self-start">
      <div className="flex items-center justify-between border border-line bg-panel p-[12px]">
        <div className="flex items-center gap-[8px]">
          <Icon src={tenderOverviewIcon} width={14} height={15.5} />
          <h3 className="font-label text-xs font-semibold tracking-[0.6px] whitespace-nowrap text-ink uppercase">
            Tender Overview
          </h3>
        </div>
        <span className="bg-ink px-[8px] py-[2px] font-label text-xs font-medium whitespace-nowrap text-white">
          CURRENT SELECTION
        </span>
      </div>

      <div className="flex flex-col gap-[20px] border border-line bg-white p-[20px] drop-shadow-panel">
        <div className="flex flex-col gap-[4px] border-b border-line pb-[12px]">
          <div className="flex items-center justify-between">
            <span className="font-label text-label-11 font-medium whitespace-nowrap text-ink-soft uppercase">
              Lot Reference
            </span>
            <span className="font-label text-xs font-bold whitespace-nowrap text-forest">TND-2025-084-ETH</span>
          </div>
          <h3 className="font-display text-xl font-medium text-ink">14 Caterpillar 336D2 Excavators &amp; Komatsu Dozers</h3>
          <p className="text-body-13 text-ink-soft">
            Federal Ministry of Transport &amp; Logistics · Liquidation Lot #04
          </p>
        </div>

        <div className="flex flex-col gap-[8px]">
          <h4 className={sectionHeading}>Essential Highlights</h4>
          <div className={`${insetBox} gap-[3.5px]`}>
            {highlights.map(({ icon, size, label, value, mono }) => (
              <div key={label} className="flex items-start justify-between">
                <div className="flex items-center gap-[6px]">
                  <Icon src={icon} width={size[0]} height={size[1]} />
                  <span className="text-body-13 whitespace-nowrap text-ink-soft">{label}</span>
                </div>
                <span
                  className={`text-right text-body-13 font-medium whitespace-nowrap text-ink ${mono ? 'font-label' : ''}`}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>

        <Section title="How to Participate">
          <ol className={`${insetBox} gap-[6px]`}>
            {steps.map((step, index) => (
              <li key={step} className="flex items-start gap-[7.99px]">
                <span className="font-label text-xs font-bold text-ink">{index + 1}.</span>
                <p className="min-w-0 flex-1 text-body-13 text-ink-soft">{step}</p>
              </li>
            ))}
          </ol>
        </Section>

        <Section title="Official Tender Documents">
          <div className="flex flex-col gap-[8px]">
            {documents.map(({ icon, size, name, meta }) => (
              <a
                key={name}
                href="#"
                className="flex items-center justify-between border border-line bg-canvas p-[8px]"
              >
                <div className="flex items-center gap-[8px]">
                  <Icon src={icon} width={size[0]} height={size[1]} />
                  <div className="flex flex-col">
                    <span className="text-body-13 font-medium whitespace-nowrap text-ink">{name}</span>
                    <span className="font-label text-[11px] leading-5 whitespace-nowrap text-ink-soft">{meta}</span>
                  </div>
                </div>
                <Icon src={downloadArrowIcon} width={10.8} height={11.7} />
              </a>
            ))}
          </div>
        </Section>

        <div className="flex flex-col gap-[8px] border-t border-line pt-[4px]">
          <button
            type="button"
            className="flex items-center justify-center gap-[8px] border border-ink bg-ink py-[10px] font-label text-label-12 font-medium whitespace-nowrap text-white uppercase"
          >
            <Icon src={submitBidIcon} width={12.6} height={13.5} />
            Submit Bid Offer
          </button>
          <button
            type="button"
            className="flex items-center justify-center border border-ink bg-white py-[10px] font-label text-label-12 font-medium whitespace-nowrap text-ink uppercase"
          >
            Download All Documents (.ZIP)
          </button>
        </div>
      </div>

      <div className={`${insetBox} gap-[8px]`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-[6px]">
            <Icon src={helpDeskIcon} width={14.4} height={12.6} />
            <span className="text-sm font-semibold whitespace-nowrap text-ink">Need Assistance?</span>
          </div>
          <span className="font-label text-xs font-bold whitespace-nowrap text-forest">HOTLINE: 8090</span>
        </div>
        <p className="text-body-13 text-ink-soft">
          Cheretanet Bidder Support Center is available Monday through Saturday (8:00 AM – 6:00 PM EAT). Visit our
          headquarters at Churchill Road, Addis Ababa.
        </p>
      </div>
    </aside>
  )
}
