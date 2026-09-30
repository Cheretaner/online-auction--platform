import { MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import logo from "../../assets/images/cheretanet-logo.png";

const linkColumns = [
  {
    title: "Explore",
    links: [
      { label: "All auctions", to: "/auctions" },
      { label: "Live auctions", to: "/auctions?status=live" },
      { label: "Published results", to: "/auctions?status=awarded" },
      { label: "How to participate", to: "/auctions#how-to-participate" },
    ],
  },
  {
    title: "Take part",
    links: [
      { label: "Create bidder account", to: "/register" },
      { label: "Sign in", to: "/login" },
      { label: "Bidder workspace", to: "/app" },
    ],
  },
  {
    title: "For institutions",
    links: [
      { label: "Organization workspace", to: "/app/organizations" },
      { label: "Manage auctions", to: "/app/auctions" },
      { label: "Sign in", to: "/login" },
    ],
  },
];

const socialLinks = [
{ label: "Telegram", href: "https://t.me/cheretanet", mark: "T" },
  { label: "YouTube", href: "https://www.youtube.com/@cheretanet", mark: "▶" },
  { label: "Facebook", href: "https://www.facebook.com/cheretanet", mark: "f" },
  { label: "Instagram", href: "https://www.instagram.com/cheretanet/", mark: "ig" },
  { label: "LinkedIn", href: "https://www.linkedin.com/company/cheretanet/", mark: "in" },
  { label: "X", href: "https://x.com/cheretanet", mark: "X" },
];

const bodyText = "text-sm leading-6 text-white/65";

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-accent-foreground text-accent">
      <div className="mx-auto max-w-[1280px] px-4 py-12 lg:px-12 lg:py-14">
        <div className="grid gap-10 border-b border-white/10 pb-10 md:grid-cols-2 lg:grid-cols-[1.3fr_2fr]">
          <div className="max-w-sm">
            <Link to="/" aria-label="Cheretanet home" className="inline-flex rounded bg-white px-2 py-1">
              <img src={logo} alt="Cheretanet" className="block h-8 w-auto object-contain" />
            </Link>
            <p className="mt-4 text-sm leading-6 text-white/75">
              A clear digital space for public auctions in Ethiopia—connecting institutions and bidders through a
              process people can follow.
            </p>
            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#d5ba70]">Follow Cheretanet</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {socialLinks.map(({ label, href, mark }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Cheretanet on ${label}`}
                    title={`${label} · Cheretanet`}
                    className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/15 px-3 text-white/75 transition-colors hover:border-[#d5ba70] hover:bg-white/10 hover:text-[#e6d69f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d5ba70]"
                  >
                    <span className="flex size-5 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold" aria-hidden="true">{mark}</span>
                    <span className="text-xs">{label}</span>
                    <span className="sr-only"> · Cheretanet</span>
                  </a>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            {linkColumns.map(({ title, links }) => (
              <nav key={title} aria-label={title} className="flex flex-col items-start gap-2">
                <h2 className="mb-1 text-xs font-semibold uppercase tracking-[0.15em] text-white">{title}</h2>
                {links.map((link) => (
                  <Link key={link.label} to={link.to} className={`${bodyText} transition-colors hover:text-white`}>
                    {link.label}
                  </Link>
                ))}
              </nav>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-5 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Cheretanet. Public auctions, made clear.</p>
          <p className="inline-flex items-center gap-1.5"><MapPin className="size-3" aria-hidden="true" /> Ethiopia</p>
        </div>
      </div>
    </footer>
  );
}
