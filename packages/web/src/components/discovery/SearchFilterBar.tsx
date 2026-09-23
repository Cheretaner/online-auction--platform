import chevronDownIcon from '../../assets/icons/chevron-down.svg'
import cpoProtectedIcon from '../../assets/icons/cpo-protected.svg'
import selectArrowIcon from '../../assets/icons/select-arrow.svg'
import verifiedFilterIcon from '../../assets/icons/verified-filter.svg'
import { Icon } from '../ui/Icon'

const tabs = [
  { label: 'All Tenders (42)', active: true },
  { label: 'Live Auctions (8)', active: false },
  { label: 'Sealed Tenders (21)', active: false },
  { label: 'Upcoming (9)', active: false },
  { label: 'Closed (4)', active: false },
]

const dropdowns = ['Category: All Categories', 'Issuer: All Organizations', 'Location: All Regions']

export function SearchFilterBar() {
  return (
    <section className="flex flex-col gap-[12px] border border-line bg-white p-[12px] drop-shadow-panel">
      <div className="flex items-center justify-between border-b border-line/60 pb-[8px]">
        <div className="flex items-center gap-[4px]">
          {tabs.map(({ label, active }) => (
            <button
              key={label}
              type="button"
              className={`px-[12px] py-[6px] font-label text-label-11 font-medium whitespace-nowrap uppercase ${
                active ? 'border border-ink bg-ink text-white' : 'text-ink-soft'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-[8px]">
          <Icon src={verifiedFilterIcon} width={16.2} height={15.3} />
          <span className="text-sm whitespace-nowrap text-ink-soft">Verified Government &amp; Public Tenders</span>
        </div>
      </div>

      <div className="flex items-start justify-center gap-[8px]">
        {dropdowns.map((label) => (
          <div key={label} className="relative min-w-px flex-1">
            <button
              type="button"
              className="flex w-full items-center border border-line bg-panel py-[8px] pr-[32px] pl-[12px] text-left text-body-13 text-ink-strong"
            >
              {label}
            </button>
            {/* Two stacked chevrons, as in the design: the native select arrow plus a custom one. */}
            <Icon
              src={selectArrowIcon}
              width={19.5}
              height={19.5}
              className="pointer-events-none absolute top-1/2 right-[9px] -translate-y-1/2"
            />
            <Icon
              src={chevronDownIcon}
              width={9}
              height={5.45625}
              className="pointer-events-none absolute top-[9px] right-[10px]"
            />
          </div>
        ))}
        <div className="flex min-w-px flex-1 items-center justify-between border border-line bg-panel px-[12px] py-[8px]">
          <div className="flex items-center gap-[6px]">
            <Icon src={cpoProtectedIcon} width={10.4} height={12.8} />
            <span className="text-body-13 whitespace-nowrap text-ink-soft">CPO Bond Protected</span>
          </div>
          <span className="font-label text-label-11 font-semibold whitespace-nowrap text-forest uppercase">
            Active
          </span>
        </div>
      </div>
    </section>
  )
}
