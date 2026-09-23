import type { ReactNode } from 'react'
import arrowRightIcon from '../../assets/icons/arrow-right.svg'
import auctionGavelIcon from '../../assets/icons/auction-gavel.svg'
import awardedCheckIcon from '../../assets/icons/awarded-check.svg'
import bondIcon from '../../assets/icons/bond.svg'
import depositConfirmedIcon from '../../assets/icons/deposit-confirmed.svg'
import downloadFileIcon from '../../assets/icons/download-file.svg'
import inspectionShieldIcon from '../../assets/icons/inspection-shield.svg'
import issuerVerifiedIcon from '../../assets/icons/issuer-verified.svg'
import locationIcon from '../../assets/icons/location.svg'
import sealedLockIcon from '../../assets/icons/sealed-lock.svg'
import timerIcon from '../../assets/icons/timer.svg'
import excavatorsYard from '../../assets/images/caterpillar-excavators-yard.jpg'
import { Icon } from '../ui/Icon'

const buttonBase =
  'flex shrink-0 items-center justify-center font-label text-label-12 font-medium text-center uppercase'

function OutlineButton({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <button type="button" className={`${buttonBase} border bg-white text-ink ${className}`}>
      {children}
    </button>
  )
}

function SolidButton({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <button type="button" className={`${buttonBase} bg-ink text-white ${className}`}>
      {children}
    </button>
  )
}

function Card({ className, children }: { className: string; children: ReactNode }) {
  return (
    <article className={`w-full ${className}`}>
      <div className="flex flex-col gap-[12px] p-[20px]">{children}</div>
    </article>
  )
}

const standardCard = 'border border-line bg-white drop-shadow-panel'

function ReferenceChip({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span className={`px-[8px] py-[2px] font-label text-xs font-medium tracking-[0.3px] whitespace-nowrap ${className}`}>
      {children}
    </span>
  )
}

function Issuer({ name, className = 'text-ink' }: { name: string; className?: string }) {
  return (
    <div className="flex items-center gap-[4px]">
      <span className={`text-body-13 font-semibold whitespace-nowrap ${className}`}>{name}</span>
      <Icon src={issuerVerifiedIcon} width={14.4} height={13.6} />
    </div>
  )
}

const Divider = () => <span className="text-sm whitespace-nowrap text-line">|</span>

function Location({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-[4px]">
      <Icon src={locationIcon} width={9.1} height={11.2} />
      <span className="font-label text-label-11 font-medium whitespace-nowrap text-ink-soft">{children}</span>
    </div>
  )
}

function LiveChips({ endsIn }: { endsIn: string }) {
  return (
    <div className="flex items-center gap-[4px]">
      <span className="flex items-center gap-[6px] border border-forest bg-forest/10 px-[10px] py-[2px]">
        <span className="size-[6px] rounded-full bg-forest" />
        <span className="font-label text-label-11 font-semibold whitespace-nowrap text-forest uppercase">
          Live Auction
        </span>
      </span>
      <span className="flex items-center gap-[4px] border border-danger/30 bg-danger-tint/40 px-[8px] py-[2px]">
        <Icon src={timerIcon} width={9.1} height={10.725} />
        <span className="font-label text-xs font-medium whitespace-nowrap text-danger">{endsIn}</span>
      </span>
    </div>
  )
}

const cardHeader = 'flex flex-col gap-[8px] border-b border-line/60 pb-[4px]'
const cardFooter = 'border-t border-line/60 pt-[4px]'
const headline = 'font-display text-xl font-medium tracking-[-0.5px] text-ink'
const price = 'font-display text-xl font-semibold tracking-[-0.5px] whitespace-nowrap text-ink text-right'
const monoLabel = 'font-label text-label-11 font-medium text-ink-soft'
const summaryBox = 'flex flex-col justify-between self-start border border-line bg-panel p-[12px]'

function FeaturedLiveListing() {
  return (
    <Card className="border-2 border-ink bg-white drop-shadow-panel">
      <div className={cardHeader}>
        <div className="flex items-center gap-[12px]">
          {/* Same colours as the Figma chip (#0c1d2d on #0e1e2e): the reference text is effectively invisible in the design. */}
          <ReferenceChip className="bg-navy text-navy-ink">TND-2025-084-ETH</ReferenceChip>
          <Issuer name="Ministry of Transport & Logistics" />
          <Divider />
          <Location>Bole Lemi Depot, Addis Ababa</Location>
        </div>
        <LiveChips endsIn="Ending in 4h 12m" />
      </div>

      <div className="grid grid-cols-12 gap-[12px]">
        <div className="col-span-4 self-start overflow-clip border border-line">
          <img src={excavatorsYard} alt="Caterpillar heavy excavators and dozers yard, Addis Ababa" className="block h-[176px] w-full object-cover" />
          <div className="flex items-center justify-between border-t border-line bg-panel px-[8px] py-[4px] text-[11px] leading-5 whitespace-nowrap">
            <span className="font-label text-ink-soft">14 Heavy Units</span>
            <span className="font-label font-medium text-forest">Field Verified</span>
          </div>
        </div>
        <div className="col-span-8 flex flex-col gap-[4px] self-start">
          <h2 className={headline}>14 Caterpillar 336D2 Excavators &amp; Komatsu Dozers</h2>
          <p className="text-body-13 leading-[1.625] text-ink-soft">
            Standard gauge rail corridor surplus package. 14 operational machinery units with verified service
            records (1,840 - 3,210 engine hours). Full mechanical inspection report available, customs clearance
            complete.
          </p>
          <div className="flex items-center gap-[12px] pt-[4px]">
            <p className={`${monoLabel} whitespace-nowrap`}>
              LOT SIZE: <span className="font-bold text-ink">14 ASSETS</span>
            </p>
            <p className={`${monoLabel} whitespace-nowrap`}>
              SETTLEMENT: <span className="font-bold text-ink">COMMERCIAL BANK OF ETHIOPIA</span>
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border border-line bg-panel p-[12px]">
        <div className="flex items-start gap-[8px]">
          <Icon src={inspectionShieldIcon} width={13} height={18} />
          <div>
            <p className="text-sm font-medium whitespace-nowrap text-ink">
              Physical Inspection Open Daily (8:30 AM – 4:30 PM)
            </p>
            <p className="text-body-13 whitespace-nowrap text-ink-soft">
              Bole Lemi Logistics Depot. Signed report by Federal Inspection Board.
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className={`${monoLabel} text-right whitespace-nowrap uppercase`}>Current Highest Tender</span>
          <span className={price}>ETB 188,200,000</span>
          <span className="font-label text-sm font-medium whitespace-nowrap text-forest">
            Reserve Met · 34 Verified Bids
          </span>
        </div>
      </div>

      <div className={`flex flex-col gap-[8px] ${cardFooter}`}>
        <div className="flex items-center gap-[6px]">
          <Icon src={bondIcon} width={12.8} height={12.8} />
          <p className="text-body-13 whitespace-nowrap text-ink-soft">
            Required 5% CPO Bond: <span className="font-label font-bold text-ink">ETB 9,410,000 (CBE)</span>
          </p>
        </div>
        <div className="flex items-center gap-[8px]">
          <OutlineButton className="gap-[6px] border-ink px-[12px] py-[6px]">
            <Icon src={downloadFileIcon} width={9.6} height={12.8} />
            Download RFP Document
          </OutlineButton>
          <SolidButton className="gap-[6px] px-[20px] py-[6px]">
            <Icon src={auctionGavelIcon} width={11.2} height={12} />
            View Auction &amp; Bid
          </SolidButton>
        </div>
      </div>
    </Card>
  )
}

function SealedTenderListing() {
  return (
    <Card className={standardCard}>
      <div className={cardHeader}>
        <div className="flex items-center gap-[12px]">
          <ReferenceChip className="bg-panel-3 text-ink">SLD-2025-019-SUB</ReferenceChip>
          <Issuer name="Ethiopian Electric Power (EEP)" />
          <Divider />
          <Location>Gilgel Gibe III Substation</Location>
        </div>
        <div className="flex items-center gap-[4px]">
          <span className="flex items-center gap-[4px] bg-navy px-[10px] py-[2px]">
            <Icon src={sealedLockIcon} width={7.8} height={11.05} />
            <span className="font-label text-label-11 font-semibold whitespace-nowrap text-white uppercase">
              Sealed Tender
            </span>
          </span>
          <span className="border border-line bg-panel-2 px-[8px] py-[2px] font-label text-xs whitespace-nowrap text-ink-soft">
            Closing Mar 14, 2025 (16:00 EAT)
          </span>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-[12px]">
        <div className="col-span-7 flex flex-col gap-[4px] self-start">
          <h2 className={headline}>High-Voltage Substation Transformers &amp; Switchgear Decommissioning</h2>
          <p className="text-body-13 leading-[1.625] text-ink-soft">
            Public enterprise salvage disposal of 4 high-capacity step-up transformers (400kV / 250MVA), SF6 gas
            circuit breakers, and copper reactor modules. Rigging and road transport permits fully approved.
          </p>
          <div className={`flex items-center gap-[12px] pt-[4px] ${monoLabel}`}>
            <p>
              TENDER FORMAT: <strong className="font-bold">SEALED BID ENVELOPE</strong>
            </p>
            <p>
              BID BOND: <strong className="font-bold">CPO OR BANK GUARANTEE</strong>
            </p>
          </div>
        </div>
        <div className={`col-span-5 ${summaryBox}`}>
          <div className="flex flex-col items-end">
            <span className={`${monoLabel} text-right whitespace-nowrap uppercase`}>Indicative Base Value</span>
            <span className={price}>ETB 490,000,000</span>
            <span className={`${monoLabel} pt-[2px] text-right whitespace-nowrap`}>
              Official Evaluation by EEP Committee
            </span>
          </div>
          <div className="pt-[4px]">
            <p className="border-t border-line/60 pt-[4px] text-right text-body-13 whitespace-nowrap text-ink-soft">
              Performance Guarantee: <span className="font-label font-bold text-ink">ETB 24,500,000</span>
            </p>
          </div>
        </div>
      </div>

      <div className={`flex items-center justify-between ${cardFooter}`}>
        <p className="text-body-13 text-ink-soft">Pre-requisite: Valid ISO 14001 Environmental Clearance</p>
        <div className="flex items-center gap-[8px]">
          <OutlineButton className="w-[210.03px] border-line-strong py-[6px]">
            Download RFP
            <br />
            Specification
          </OutlineButton>
          <SolidButton className="w-[222.17px] py-[6px]">
            Review Requirements &amp;
            <br />
            Submit
          </SolidButton>
        </div>
      </div>
    </Card>
  )
}

function LiveAuctionListing() {
  return (
    <Card className={standardCard}>
      <div className={cardHeader}>
        <div className="flex items-center gap-[12px]">
          <ReferenceChip className="bg-panel-3 text-ink">TND-2025-102-MAR</ReferenceChip>
          <Issuer name="Maritime Affairs Authority" />
          <Divider />
          <Location>Djibouti-Dire Dawa Corridor Dry Port</Location>
        </div>
        <LiveChips endsIn="Ending in 1h 45m" />
      </div>

      <div className="grid grid-cols-12 gap-[12px]">
        <div className="col-span-7 flex flex-col gap-[4px] self-start">
          <h2 className={headline}>Commercial Port Crane Equipment (2x 65-Ton Rail Container Gantries)</h2>
          <p className="text-body-13 leading-[1.625] text-ink-soft">
            Heavy-duty rail-mounted container handling gantry cranes with 42m outreach boom arm. Fully documented
            maintenance lifecycle under Bureau Veritas supervision. Clear transfer certificate.
          </p>
          <div className={`flex items-center gap-[12px] pt-[4px] ${monoLabel}`}>
            <p>
              FACILITY: <strong className="font-bold">DIRE DAWA LOGISTICS TERMINAL</strong>
            </p>
            <p>
              INCREMENT: <strong className="font-bold">ETB 5,000,000</strong>
            </p>
          </div>
        </div>
        <div className={`col-span-5 ${summaryBox}`}>
          <div className="flex flex-col items-end">
            <span className={`${monoLabel} text-right whitespace-nowrap uppercase`}>Current Highest Tender</span>
            <span className={price}>ETB 650,000,000</span>
            <span className="flex items-center gap-[4px] pt-[2px]">
              <Icon src={depositConfirmedIcon} width={11.2} height={11.2} />
              <span className="font-label text-label-11 font-medium whitespace-nowrap text-forest">
                CPO Deposit Confirmed
              </span>
            </span>
          </div>
          <div className="pt-[4px]">
            <p className="border-t border-line/60 pt-[4px] text-right text-body-13 whitespace-nowrap text-ink-soft">
              Required Bond: <span className="font-label font-bold text-ink">ETB 32,500,000 (5%)</span>
            </p>
          </div>
        </div>
      </div>

      <div className={`flex items-center justify-between ${cardFooter}`}>
        <p className="pr-[62.25px] text-body-13 text-ink-soft">
          Eligible: Licensed Freight &amp; Port Mechanization Operators
        </p>
        <div className="flex items-center gap-[7.99px]">
          <OutlineButton className="w-[204.52px] border-line-strong py-[6px]">
            Technical
            <br />
            Specification
          </OutlineButton>
          <SolidButton className="w-[187.04px] justify-start gap-[34.82px] py-[6px] pr-[50.82px] pl-[20px]">
            <Icon src={auctionGavelIcon} width={11.2} height={12} />
            <span>
              Join Live
              <br />
              Auction
            </span>
          </SolidButton>
        </div>
      </div>
    </Card>
  )
}

function AwardedListing() {
  return (
    <Card className="border border-line bg-panel/70 opacity-90">
      <div className="flex items-center justify-between border-b border-line/60 pb-[4px]">
        <div className="flex items-center gap-[12px]">
          <ReferenceChip className="bg-panel-2 text-ink-soft">AUD-2025-055-SPEC</ReferenceChip>
          <Issuer name="Ethio Telecom" className="text-ink-strong" />
          <Divider />
          <span className={`${monoLabel} whitespace-nowrap`}>Multi-region Grid Sites</span>
        </div>
        <span className="flex items-center gap-[6px] bg-panel-4 px-[10px] py-[2px]">
          <Icon src={awardedCheckIcon} width={11.2} height={11.2} />
          <span className="font-label text-label-11 font-semibold whitespace-nowrap text-ink-strong uppercase">
            Completed &amp; Awarded
          </span>
        </span>
      </div>

      <div className="grid grid-cols-12 gap-[12px]">
        <div className="col-span-7 flex flex-col gap-[4px] self-center">
          <h3 className="font-display text-xl font-medium text-ink-strong">
            Ethio Telecom Steel Lattice Cellular Towers &amp; Solar Generator Sets
          </h3>
          <p className="text-body-13 text-ink-soft">
            120 decommissioned steel lattice mobile communication towers and accompanying hybrid solar diesel
            generator modules across Oromia and Amhara regions.
          </p>
          <p className="pt-[4px] text-body-13 text-ink-soft">
            Awarded Contractor: <span className="font-bold text-ink">VeriGrid East Africa Ltd (Addis Ababa)</span>
          </p>
        </div>
        <div className="col-span-5 flex flex-col items-end self-center border border-line bg-panel-2 p-[12px]">
          <span className={`${monoLabel} whitespace-nowrap uppercase`}>Final Sale Price</span>
          <span className={price}>ETB 338,000,000</span>
          <span className="pt-[2px] font-label text-label-11 font-medium whitespace-nowrap text-forest">
            Tender Closed &amp; Title Transferred
          </span>
        </div>
      </div>

      <div className={`flex items-center justify-between ${cardFooter}`}>
        <p className="text-body-13 whitespace-nowrap text-ink-soft">Publication Reference: FPPA-ET-2025-Q1</p>
        <a href="#" className="flex items-center gap-[4px]">
          <span className="text-body-13 font-medium whitespace-nowrap text-ink underline decoration-1 [text-decoration-skip-ink:none] [text-underline-position:from-font]">
            Download Official Award Notice
          </span>
          <Icon src={arrowRightIcon} width={8.4} height={8.4} />
        </a>
      </div>
    </Card>
  )
}

export function ListingFeed() {
  return (
    <section className="col-span-8 flex flex-col gap-[12px]">
      <FeaturedLiveListing />
      <SealedTenderListing />
      <LiveAuctionListing />
      <AwardedListing />
    </section>
  )
}
