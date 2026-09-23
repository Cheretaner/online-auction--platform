import clockIcon from '../../assets/icons/clock.svg'
import helpCircleIcon from '../../assets/icons/help-circle.svg'
import searchIcon from '../../assets/icons/search.svg'
import logo from '../../assets/images/cheretanet-logo.png'
import { Icon } from '../ui/Icon'

const navItems = [
  { label: 'Browse Auctions', active: true },
  { label: 'Active Bids', active: false },
  { label: 'Past Results', active: false },
  { label: 'How It Works', active: false },
]

const utilityText = 'font-label text-label-11 font-medium whitespace-nowrap'

function UtilityBar() {
  return (
    <div className="border-b border-line/60 bg-panel">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between px-[48px] py-[6px]">
        <div className="flex items-center gap-[12px]">
          <div className="flex items-center gap-[6px] pr-[20.69px]">
            <span className="h-[8px] w-[7.38px] shrink-0 rounded-full bg-forest" />
            <p className={`${utilityText} text-forest`}>
              Official National Public Procurement &amp; Auction
              <br />
              Portal
            </p>
          </div>
          <span className={`${utilityText} text-line`}>·</span>
          <p className={`${utilityText} pr-[19.51px] text-ink-soft`}>
            Certified by Federal Public Procurement Authority
            <br />
            (FPPA)
          </p>
        </div>

        <div className="flex items-center gap-[12px]">
          <div className="flex items-center gap-[4px] pr-[31.59px]">
            <Icon src={clockIcon} width={11.2} height={11.2} />
            <p className={`${utilityText} text-ink-soft`}>
              EAT 17:02 (Addis
              <br />
              Ababa)
            </p>
          </div>
          <span className={`${utilityText} text-line`}>|</span>
          <a href="#" className="flex items-center gap-[3.99px] pr-[35.22px]">
            <Icon src={helpCircleIcon} width={11.2} height={11.2} />
            <p className={`${utilityText} text-ink-soft`}>
              Help Center
              <br />
              (8090)
            </p>
          </a>
          <span className={`${utilityText} text-line`}>|</span>
          <div className="flex items-center gap-[4px]">
            <span className={`${utilityText} font-semibold text-forest`}>EN</span>
            <span className={`${utilityText} font-semibold text-line`}>/</span>
            <button
              type="button"
              className="font-amharic text-label-11 font-bold whitespace-nowrap text-ink"
            >
              አማርኛ
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function MainNavigation() {
  return (
    <div className="mx-auto flex h-[80px] max-w-[1280px] items-center justify-between px-[48px]">
      <div className="flex items-center gap-[32px]">
        <a href="#" className="block h-[32px] w-[136px]">
          <img src={logo} alt="Cheretanet" className="block h-full w-full" />
        </a>
        <nav className="flex items-center gap-[20px]">
          {navItems.map(({ label, active }) => (
            <a
              key={label}
              href="#"
              className={
                active
                  ? 'border-b-2 border-ink py-[8px] text-sm font-semibold whitespace-nowrap text-ink'
                  : 'py-[8px] text-sm whitespace-nowrap text-ink-soft'
              }
            >
              {label}
            </a>
          ))}
        </nav>
      </div>

      <div className="min-w-px max-w-[480px] flex-1 px-[16px]">
        <div className="relative mx-auto max-w-[448px]">
          <input
            type="search"
            placeholder="Search vehicles, real estate, machinery, government tenders..."
            className="block h-[32px] w-full border border-line bg-white pr-[12px] pl-[36px] text-body-13 text-ink placeholder:text-ink-soft/70"
          />
          <Icon
            src={searchIcon}
            width={12.6}
            height={12.6}
            className="pointer-events-none absolute top-[7px] left-[12px]"
          />
        </div>
      </div>

      <div className="flex items-center gap-[8px]">
        <a
          href="#"
          className="px-[12px] py-[8px] font-label text-label-12 font-medium whitespace-nowrap text-ink uppercase"
        >
          Verify Account / Sign In
        </a>
        <a
          href="#"
          className="border border-ink bg-ink px-[12px] py-[8px] font-label text-label-12 font-medium whitespace-nowrap text-white uppercase"
        >
          Register as Bidder
        </a>
      </div>
    </div>
  )
}

export function Header() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-line bg-canvas drop-shadow-panel">
      <UtilityBar />
      <MainNavigation />
    </header>
  )
}
