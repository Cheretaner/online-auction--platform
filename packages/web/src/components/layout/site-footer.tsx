import { ArrowUpRight, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { BrandLogo } from "@/components/layout/brand-logo";
import { useT } from "@/i18n/context";
import type { messages } from "@/i18n/messages";

type FooterKey = Exclude<keyof (typeof messages)["layout"]["en"]["footer"], "copyright">;

const linkColumns: Array<{ title: FooterKey; links: Array<{ label: FooterKey; to: string }> }> = [
  {
    title: "explore",
    links: [
      { label: "allAuctions", to: "/auctions" },
      { label: "liveAuctions", to: "/auctions?status=live" },
      { label: "publishedResults", to: "/auctions?status=awarded" },
      { label: "howToParticipate", to: "/auctions#how-to-participate" },
    ],
  },
  {
    title: "takePart",
    links: [
      { label: "createAccount", to: "/register" },
      { label: "signIn", to: "/login" },
      { label: "bidderWorkspace", to: "/app" },
    ],
  },
  {
    title: "institutions",
    links: [
      { label: "orgWorkspace", to: "/app/organizations" },
      { label: "manageAuctions", to: "/app/auctions" },
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
  const t = useT("layout");
  return (
    <footer className="site-footer bg-inverse text-inverse-foreground">
      <div className="page-container py-10 sm:py-12 lg:py-14">
        <div className="grid items-start gap-x-12 gap-y-10 border-b border-inverse-foreground/15 pb-10 md:grid-cols-[minmax(15rem,0.9fr)_minmax(0,2fr)] lg:gap-x-20">
          <div className="max-w-md">
            <BrandLogo tone="inverse" className="focus-visible:ring-highlight focus-visible:ring-offset-inverse" />
            <p className="mt-4 max-w-sm text-sm leading-6 text-inverse-foreground/75">
              {t("footer.about")}
            </p>
            <p className="eyebrow mt-6 text-highlight">{t("footer.follow")}</p>
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
                    <span className="sr-only"> {t("footer.newTab")}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-3 lg:gap-x-10">
            {linkColumns.map(({ title, links }) => (
              <nav key={title} aria-label={t(`footer.${title}`)}>
                <h2 className="eyebrow text-inverse-foreground">{t(`footer.${title}`)}</h2>
                <ul className="mt-4 flex flex-col gap-1.5">
                  {links.map((link) => (
                    <li key={link.label}>
                      <Link to={link.to} className={footerLink}>
                        {t(`footer.${link.label}`)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-6 text-xs text-inverse-foreground/70 sm:flex-row sm:items-center sm:justify-between">
          <p>{t("footer.copyright", { year: new Date().getFullYear() })}</p>
          <p className="inline-flex items-center gap-1.5">
            <MapPin className="size-3.5" aria-hidden /> {t("footer.location")}
          </p>
        </div>
      </div>
    </footer>
  );
}
