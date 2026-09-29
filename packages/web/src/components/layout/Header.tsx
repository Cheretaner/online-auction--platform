import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import clockIcon from '../../assets/icons/clock.svg'
import helpCircleIcon from '../../assets/icons/help-circle.svg'
import searchIcon from '../../assets/icons/search.svg'
import logo from '../../assets/images/cheretanet-logo.png'
import { useAuth } from '@/features/auth/auth-provider'
import { useLogout } from '@/features/auth/queries'
import { Icon } from '../ui/Icon'

const utilityText = 'font-label text-label-11 font-medium whitespace-nowrap'

function useAddisClock() {
  const format = () =>
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Addis_Ababa', hour: '2-digit', minute: '2-digit' }).format(
      new Date(),
    )
  const [time, setTime] = useState(format)
  useEffect(() => {
    const timer = setInterval(() => setTime(format()), 30_000)
    return () => clearInterval(timer)
  }, [])
  return time
}

function UtilityBar() {
  const time = useAddisClock()
  return (
    <div className="hidden border-b border-line/60 bg-panel md:block">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between px-4 py-[6px] lg:px-[48px]">
        <div className="flex items-center gap-[6px]">
          <span className="h-[8px] w-[7.38px] shrink-0 rounded-full bg-forest" />
          <p className={`${utilityText} text-forest`}>Transparent Public Auction Portal</p>
        </div>

        <div className="flex items-center gap-[12px]">
          <div className="flex items-center gap-[4px]">
            <Icon src={clockIcon} width={11.2} height={11.2} />
            <p className={`${utilityText} text-ink-soft`}>EAT {time} (Addis Ababa)</p>
          </div>
          <span className={`${utilityText} text-line`}>|</span>
          <Link to="/auctions#how-to-participate" className="flex items-center gap-[4px]">
            <Icon src={helpCircleIcon} width={11.2} height={11.2} />
            <span className={`${utilityText} text-ink-soft`}>How it works</span>
          </Link>
        </div>
      </div>
    </div>
  )
}

function SearchBox() {
  const location = useLocation()
  const navigate = useNavigate()
  const current = new URLSearchParams(location.search).get('q') ?? ''
  const [value, setValue] = useState(current)
  // Follow the URL when it changes elsewhere (a tab, the back button),
  // using React's "adjust state during render" pattern.
  const [synced, setSynced] = useState(current)
  if (current !== synced) {
    setSynced(current)
    setValue(current)
  }

  // Debounced: typing updates the listing without a request per keystroke.
  useEffect(() => {
    if (value === current) return
    const timer = setTimeout(() => {
      const params = new URLSearchParams(location.pathname === '/auctions' ? location.search : '')
      if (value.trim()) params.set('q', value.trim())
      else params.delete('q')
      params.delete('page')
      const search = params.toString()
      navigate(`/auctions${search ? `?${search}` : ''}`, { replace: location.pathname === '/auctions' })
    }, 350)
    return () => clearTimeout(timer)
  }, [value, current, location.pathname, location.search, navigate])

  return (
    <div className="relative mx-auto max-w-[448px]">
      <label htmlFor="discovery-search" className="sr-only">
        Search auctions
      </label>
      <input
        id="discovery-search"
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search vehicles, machinery, property, government tenders..."
        className="block h-[32px] w-full border border-line bg-card pr-[12px] pl-[36px] text-body-13 text-ink placeholder:text-ink-soft/70"
      />
      <Icon src={searchIcon} width={12.6} height={12.6} className="pointer-events-none absolute top-[10px] left-[12px]" />
    </div>
  )
}

const navLink = ({ isActive }: { isActive: boolean }) =>
  isActive
    ? 'border-b-2 border-primary py-[8px] text-sm font-semibold whitespace-nowrap text-primary'
    : 'py-[8px] text-sm whitespace-nowrap text-ink-soft hover:text-ink'

function MainNavigation() {
  const { isAuthenticated, session } = useAuth()
  const logout = useLogout()
  const navigate = useNavigate()
  return (
    <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-3 px-4 py-3 lg:h-[80px] lg:flex-nowrap lg:px-[48px] lg:py-0">
      <div className="flex items-center gap-[32px]">
        <Link to="/" className="block h-[32px] w-[136px]">
          <img src={logo} alt="Cheretanet" className="block h-full w-full" />
        </Link>
        <nav className="hidden items-center gap-[20px] lg:flex" aria-label="Main">
          <NavLink to="/auctions" end className={navLink}>
            Browse Auctions
          </NavLink>
          {isAuthenticated ? (
            <NavLink to="/app/deposits" className={navLink}>
              My Deposits
            </NavLink>
          ) : null}
          <Link to="/auctions?status=awarded" className="py-[8px] text-sm whitespace-nowrap text-ink-soft hover:text-ink">
            Past Results
          </Link>
        </nav>
      </div>

      <div className="order-last w-full lg:order-none lg:w-auto lg:min-w-px lg:max-w-[480px] lg:flex-1 lg:px-[16px]">
        <SearchBox />
      </div>

      <div className="flex items-center gap-[8px]">
        {isAuthenticated ? (
          <>
            <Link
              to="/app"
              className="px-[12px] py-[8px] font-label text-label-12 font-medium whitespace-nowrap text-ink uppercase"
            >
              {session?.user.fullName.split(' ')[0] ?? 'My'} · Workspace
            </Link>
            <button
              type="button"
              onClick={() => {
                logout()
                navigate('/auctions')
              }}
              className="border border-primary px-[12px] py-[8px] font-label text-label-12 font-medium whitespace-nowrap text-primary uppercase"
            >
              Sign Out
            </button>
          </>
        ) : (
          <>
            <Link
              to="/login"
              state={{ from: '/auctions' }}
              className="px-[12px] py-[8px] font-label text-label-12 font-medium whitespace-nowrap text-ink uppercase"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="border border-primary bg-primary px-[12px] py-[8px] font-label text-label-12 font-medium whitespace-nowrap text-primary-foreground uppercase"
            >
              Register as Bidder
            </Link>
          </>
        )}
      </div>
    </div>
  )
}

export function Header() {
  return (
    <header className="sticky inset-x-0 top-0 z-50 border-b border-line bg-canvas drop-shadow-panel">
      <UtilityBar />
      <MainNavigation />
    </header>
  )
}
