import { Link } from 'react-router-dom'
import logo from '../../assets/images/cheretanet-logo.png'

const linkColumns = [
  {
    title: 'Quick Links',
    links: [
      { label: 'Browse All Auctions', to: '/auctions' },
      { label: 'Live Auctions', to: '/auctions?status=live' },
      { label: 'Past Auction Results', to: '/auctions?status=awarded' },
    ],
  },
  {
    title: 'For Bidders',
    links: [
      { label: 'Register as a Bidder', to: '/register' },
      { label: 'Verify Your Identity', to: '/app/kyc' },
      { label: 'Step-by-Step Bidding Guide', to: '/auctions#how-to-participate' },
    ],
  },
  {
    title: 'Institutional Issuers',
    links: [
      { label: 'Organization Workspace', to: '/app/auctions' },
      { label: 'Sign In', to: '/login' },
    ],
  },
]

const bodyText = 'text-body-13 text-ink-soft'

export function Footer() {
  return (
    <footer className="border-t border-line bg-panel">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-[19.5px] px-4 py-[32px] lg:px-[48px]">
        <div className="grid gap-[20px] border-b border-line pb-[20px] sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-[4px]">
            <div className="pb-[4px]">
              <img src={logo} alt="Cheretanet" className="block h-[28px] w-auto" />
            </div>
            <p className={`${bodyText} leading-[21.13px]`}>
              Transparent institutional auctions: every bid, approval and decision is recorded in a tamper-evident
              audit trail.
            </p>
          </div>

          {linkColumns.map(({ title, links }) => (
            <div key={title} className="flex flex-col gap-[4px]">
              <h3 className="font-label text-label-12 font-semibold text-ink uppercase">{title}</h3>
              {links.map((link) => (
                <Link key={link.label} to={link.to} className={`${bodyText} hover:text-ink`}>
                  {link.label}
                </Link>
              ))}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={bodyText}>© {new Date().getFullYear()} Cheretanet. All rights reserved.</p>
          <div className="flex items-center gap-[4px]">
            <span className="size-[8px] rounded-full bg-forest" />
            <span className="text-body-13 font-medium whitespace-nowrap text-forest">Portal Active</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
