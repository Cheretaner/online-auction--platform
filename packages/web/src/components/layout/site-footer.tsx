import { ArrowUpRight, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { BrandLogo } from "@/components/layout/brand-logo";

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
    ],
  },
];

const socialLinks = [
  { label: "Telegram", href: "https://t.me/cheretanet" },
  { label: "YouTube", href: "https://www.youtube.com/@cheretanet" },
  { label: "Facebook", href: "https://www.facebook.com/cheretanet" },
  { label: "Instagram", href: "https://www.instagram.com/cheretanet/" },
  { label: "LinkedIn", href: "https://www.linkedin.com/company/cheretanet/" },
  { label: "X", href: "https://x.com/cheretanet" },
];

const footerLink =
  "rounded-sm text-sm leading-6 text-inverse-foreground/70 transition-colors hover:text-inverse-foreground focus-visible:ring-highlight focus-visible:ring-offset-inverse";

export function SiteFooter() {
  return (
    <footer className="bg-inverse text-inverse-foreground">
      <div className="page-container py-12 lg:py-16">
        <div className="grid gap-10 border-b border-inverse-foreground/10 pb-10 md:grid-cols-2 lg:grid-cols-[1.2fr_2fr]">
          <div className="max-w-sm">
            <BrandLogo tone="inverse" className="focus-visible:ring-highlight focus-visible:ring-offset-inverse" />
            <p className="mt-5 text-sm leading-6 text-inverse-foreground/75">
              A clear digital space for public auctions in Ethiopia—connecting institutions and bidders through a
              process people can follow.
            </p>
            <p className="eyebrow mt-6 text-highlight">Follow Cheretanet</p>
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
              {socialLinks.map(({ label, href }) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className={`${footerLink} inline-flex min-h-8 items-center gap-1`}
                  >
                    {label}
                    <ArrowUpRight className="size-3.5 opacity-60" aria-hidden />
                    <span className="sr-only"> (Cheretanet, opens in a new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {linkColumns.map(({ title, links }) => (
              <nav key={title} aria-label={title}>
                <h2 className="eyebrow text-inverse-foreground">{title}</h2>
                <ul className="mt-4 flex flex-col gap-1.5">
                  {links.map((link) => (
                    <li key={link.label}>
                      <Link to={link.to} className={footerLink}>
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-6 text-xs text-inverse-foreground/55 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Cheretanet. Public auctions, made clear.</p>
          <p className="inline-flex items-center gap-1.5">
            <MapPin className="size-3.5" aria-hidden /> Ethiopia
          </p>
        </div>
      </div>
    </footer>
  );
}
