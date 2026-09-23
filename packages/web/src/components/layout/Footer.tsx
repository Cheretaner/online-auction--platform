import logo from '../../assets/images/cheretanet-logo.png'

const linkColumns = [
  {
    title: 'Quick Links',
    links: ['Browse All Auctions', 'Tender Categories', 'Past Auction Results', 'Legal Framework & Acts'],
  },
  {
    title: 'For Bidders',
    links: [
      'CPO Bond Requirements',
      'Bidder Eligibility & Licensing',
      'Step-by-Step Bidding Guide',
      'Frequently Asked Questions',
    ],
  },
  {
    title: 'Institutional Issuers',
    links: [
      'Publish a Public Auction',
      'Public Enterprise Verification',
      'Directives & Circulars',
      'Contact Authority Liaison',
    ],
  },
]

const bodyText = 'text-body-13 text-ink-soft'
const separator = <span className={bodyText}>·</span>

export function Footer() {
  return (
    <footer className="border-t border-line bg-panel">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-[19.5px] px-[48px] py-[32px]">
        <div className="flex items-start justify-center gap-[20px] border-b border-line pb-[20px]">
          <div className="flex min-w-px flex-1 flex-col gap-[4px]">
            <div className="pb-[4px]">
              {/* The logo crop below is copied as-is from the Figma footer (it is squashed in the design). */}
              <div className="relative h-[28px] w-[119px] overflow-hidden">
                <img
                  src={logo}
                  alt="Cheretanet"
                  className="pointer-events-none absolute top-0 left-[-68.07%] h-full w-[236.13%] max-w-none"
                />
              </div>
            </div>
            <p className={`${bodyText} leading-[21.13px]`}>
              The National Institutional Auction &amp; Procurement Platform. Facilitating transparent,
              legally compliant public asset disposal and competitive state tenders.
            </p>
          </div>

          {linkColumns.map(({ title, links }) => (
            <div key={title} className="flex min-w-px flex-1 flex-col gap-[4px] pb-[16.5px]">
              <h3 className="font-label text-label-12 font-semibold text-ink uppercase">{title}</h3>
              {links.map((link) => (
                <a key={link} href="#" className={bodyText}>
                  {link}
                </a>
              ))}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-[12px]">
            <p className={`${bodyText} whitespace-nowrap`}>© 2025 Cheretanet. All rights reserved.</p>
            {separator}
            <p className={`${bodyText} whitespace-nowrap`}>
              Compliant with Ethiopian Federal Public Procurement Directives.
            </p>
          </div>
          <div className="flex items-center gap-[12px]">
            <a href="#" className={`${bodyText} whitespace-nowrap`}>
              Privacy Policy
            </a>
            {separator}
            <a href="#" className={`${bodyText} whitespace-nowrap`}>
              Terms of Auction Service
            </a>
            {separator}
            <div className="flex items-center gap-[4px]">
              <span className="size-[8px] rounded-full bg-forest" />
              <span className="text-body-13 font-medium whitespace-nowrap text-forest">Portal Active</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
