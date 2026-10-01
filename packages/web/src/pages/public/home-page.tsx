import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Banknote,
  Boxes,
  Building2,
  CarFront,
  Check,
  ChevronDown,
  Clock3,
  FileSearch,
  Gavel,
  Landmark,
  LockKeyhole,
  MapPin,
  Search,
  Truck,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionHeader } from "@/components/layout/page-header";
import { AuctionCard } from "@/features/auctions/auction-card";
import { usePublicAuctions } from "@/features/auctions/queries";
import { useCategories, useOrganizations } from "@/features/operations/queries";
import { APP_NAME } from "@/config/env";
import auctionYard from "@/assets/images/caterpillar-excavators-yard.jpg";

const participationSteps = [
  {
    number: "01",
    title: "Find and review",
    text: "Search public notices. Check the issuer, asset details, closing date, eligibility, and auction rules.",
  },
  {
    number: "02",
    title: "Prepare your account",
    text: "Register and complete identity verification. Your verification carries across auctions on the platform.",
  },
  {
    number: "03",
    title: "Meet the requirements",
    text: "Submit the CPO or bank guarantee shown on the listing, if bid security is required, and wait for confirmation.",
  },
  {
    number: "04",
    title: "Bid and follow the result",
    text: "Take part while bidding is open. Return to the auction page to follow its published status and outcome.",
  },
];

function formatCount(value: number | undefined, isLoading: boolean): string {
  return isLoading ? "—" : new Intl.NumberFormat("en-US").format(value ?? 0);
}

export default function HomePage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const live = usePublicAuctions({ status: "live", limit: 3 });
  const upcoming = usePublicAuctions({ status: "scheduled", limit: 1 });
  const results = usePublicAuctions({ status: "awarded", limit: 1 });
  const categories = useCategories();
  const organizations = useOrganizations();
  const liveAuctions = live.data?.items ?? [];
  const activeIssuers = (organizations.data?.items ?? []).filter((organization) => organization.isActive);
  const visibleCategories = (categories.data?.items ?? []).slice(0, 6);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    navigate(`/auctions${params.size ? `?${params.toString()}` : ""}`);
  }

  return (
    <div className="space-y-16 pb-8 sm:space-y-20 lg:space-y-24">
      <section className="relative isolate -mt-2 overflow-hidden rounded-xl bg-inverse text-inverse-foreground shadow-lg sm:-mt-4">
        <img
          src={auctionYard}
          alt="Heavy equipment prepared for public asset sale"
          className="absolute inset-0 -z-20 size-full object-cover object-center"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-inverse/95 via-inverse/85 to-inverse/30 lg:to-inverse/10" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-inverse/70 via-transparent to-inverse/10" />

        <div className="grid min-h-[520px] items-end gap-10 px-6 py-9 sm:px-10 sm:py-12 lg:grid-cols-[1.1fr_0.65fr] lg:items-center lg:px-14 lg:py-16">
          <div className="max-w-2xl">
            <p className="eyebrow inline-flex items-center gap-2 text-highlight">
              <span className="size-1.5 rounded-full bg-highlight" aria-hidden="true" />
              Public asset auctions · Ethiopia
            </p>
            <h1 className="mt-5 max-w-2xl text-4xl leading-[1.06] font-semibold text-inverse-foreground sm:text-5xl lg:text-6xl">
              Every opportunity deserves a process people can follow.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-inverse-foreground/80 sm:text-lg sm:leading-8">
              {APP_NAME} brings auction notices, bidder participation, and published outcomes together—so people can
              see what is offered, understand what is required, and know what happens next.
            </p>

            <form onSubmit={submitSearch} role="search" className="mt-8 flex max-w-xl flex-col gap-2 rounded-lg bg-card p-2 shadow-xl sm:flex-row">
              <label htmlFor="home-auction-search" className="sr-only">Search public auctions</label>
              <div className="flex min-w-0 flex-1 items-center gap-3 px-3">
                <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <input
                  id="home-auction-search"
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search vehicles, equipment, property..."
                  className="h-11 min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
                />
              </div>
              <Button type="submit" size="lg">
                Search auctions <ArrowRight aria-hidden="true" />
              </Button>
            </form>

            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-inverse-foreground/75">
              <Link to="/auctions?status=live" className="inline-flex items-center gap-1.5 rounded-sm hover:text-inverse-foreground">
                <span className="size-1.5 rounded-full bg-highlight" aria-hidden="true" /> View live auctions
              </Link>
              <Link to="/auctions?status=scheduled" className="inline-flex items-center gap-1.5 rounded-sm hover:text-inverse-foreground">
                <Clock3 className="size-3.5" aria-hidden="true" /> See upcoming auctions
              </Link>
            </div>
          </div>

          <div className="hidden justify-self-end lg:block">
            <div className="w-64 rounded-lg border border-inverse-foreground/15 bg-inverse/80 p-5 shadow-xl backdrop-blur-md">
              <p className="eyebrow text-highlight">One connected process</p>
              <div className="mt-5 space-y-4">
                {[
                  ["01", "Notice published"],
                  ["02", "Bidders participate"],
                  ["03", "Outcome recorded"],
                ].map(([number, label], index) => (
                  <div key={number} className="flex items-center gap-3">
                    <span className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${index === 2 ? "bg-highlight text-inverse" : "border border-inverse-foreground/25"}`}>
                      {index === 2 ? <Check className="size-4" aria-hidden="true" /> : number}
                    </span>
                    <span className="text-sm text-inverse-foreground/90">{label}</span>
                  </div>
                ))}
              </div>
              <p className="mt-5 border-t border-inverse-foreground/15 pt-4 text-xs leading-5 text-inverse-foreground/65">
                Clear information for bidders. A traceable workspace for institutions.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section aria-label="Auction activity" className="grid divide-y overflow-hidden rounded-lg border bg-card shadow-xs sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <MetricLink
          to="/auctions?status=live"
          label="Open for bidding"
          value={formatCount(live.data?.total, live.isLoading)}
          note="Live auctions"
          loading={live.isLoading}
        />
        <MetricLink
          to="/auctions?status=scheduled"
          label="Coming up"
          value={formatCount(upcoming.data?.total, upcoming.isLoading)}
          note="Scheduled auctions"
          loading={upcoming.isLoading}
        />
        <MetricLink
          to="/auctions?status=awarded"
          label="Past decisions"
          value={formatCount(results.data?.total, results.isLoading)}
          note="Published results"
          loading={results.isLoading}
        />
      </section>

      <section aria-labelledby="live-auctions-title" className="space-y-5">
        <SectionHeader size="display"
          id="live-auctions-title"
          eyebrow="Open now"
          title="Opportunities ready for your attention"
          description="Each listing shows the information you need to decide whether and how to participate."
          action={<TextLink to="/auctions?status=live" label="Browse all live auctions" />}
        />
        {live.isError ? (
          <Card className="flex flex-col items-start gap-3 border-dashed p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-semibold">Live auctions are temporarily unavailable.</h3>
              <p className="mt-1 text-sm text-muted-foreground">The rest of the public catalogue is still available.</p>
            </div>
            <Button type="button" variant="outline" onClick={() => void live.refetch()}>Reload auctions</Button>
          </Card>
        ) : live.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading live auctions">
            {Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-72 rounded-lg" />)}
          </div>
        ) : liveAuctions.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {liveAuctions.map((auction) => <AuctionCard key={auction.id} auction={auction} />)}
          </div>
        ) : (
          <Card className="flex flex-col gap-4 border-dashed p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div>
              <h3 className="text-lg font-semibold">No auctions are open right now.</h3>
              <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
                Review scheduled notices to prepare, or browse published results to understand completed auctions.
              </p>
            </div>
            <Button asChild variant="outline"><Link to="/auctions?status=scheduled">View upcoming auctions</Link></Button>
          </Card>
        )}
      </section>

      {visibleCategories.length ? (
        <section aria-labelledby="categories-title" className="space-y-5">
          <SectionHeader size="display"
          id="categories-title"
            eyebrow="Browse by asset"
            title="Start with what you are looking for"
            description="Choose a category to narrow the public auction catalogue."
            action={<TextLink to="/auctions" label="See every category" />}
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleCategories.map((category) => {
              const Icon = categoryIcon(category.slug);
              return (
                <Link
                  key={category.id}
                  to={`/auctions?categoryId=${encodeURIComponent(category.id)}`}
                  className="group flex min-h-28 items-center gap-4 rounded-lg border bg-card p-4 shadow-xs transition-[border-color,box-shadow] hover:border-primary/35 hover:shadow-md sm:p-5"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{category.name}</span>
                    <span className="mt-1 block line-clamp-2 text-sm leading-5 text-muted-foreground">
                      {category.description || "View auctions in this category."}
                    </span>
                  </span>
                  <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="grid gap-10 rounded-xl bg-inverse p-6 text-inverse-foreground sm:p-9 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:p-12" aria-labelledby="process-title">
        <div>
          <p className="eyebrow text-highlight">A clear route to participation</p>
          <h2 id="process-title" className="mt-3 max-w-md text-3xl leading-tight font-semibold text-inverse-foreground sm:text-4xl">
            Know what is expected before you place a bid.
          </h2>
          <p className="mt-4 max-w-md text-sm leading-6 text-inverse-foreground/75">
            The requirements are shown with each auction. Take time to read them: verification, bid security, and timing
            can vary from one notice to another.
          </p>
          <Button asChild className="mt-6 bg-highlight text-inverse hover:bg-highlight-strong">
            <Link to="/auctions#how-to-participate">Read the bidder guide <ArrowRight aria-hidden="true" /></Link>
          </Button>
        </div>
        <ol className="grid gap-0 sm:grid-cols-2">
          {participationSteps.map((step, index) => (
            <li key={step.number} className={`border-inverse-foreground/15 py-5 ${index < 2 ? "border-b" : ""} ${index % 2 === 0 ? "sm:pr-6" : "sm:border-l sm:pl-6"}`}>
              <p className="eyebrow text-highlight">Step {step.number}</p>
              <h3 className="mt-2 text-lg font-semibold text-inverse-foreground">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-inverse-foreground/70">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="auction-formats-title" className="space-y-5">
        <SectionHeader size="display"
          id="auction-formats-title"
          eyebrow="Two ways to participate"
          title="Understand the auction format"
          description="The listing tells you which format applies. The rules and visibility differ."
        />
        <div className="grid gap-4 md:grid-cols-2">
          <FormatCard
            icon={Gavel}
            title="Open ascending"
            eyebrow="Visible bidding"
            description="Eligible bidders can follow the current bid while the auction is live. Each new offer must meet the published minimum increment."
            points={["Current bid is shown during the auction", "Closing time and extensions are visible"]}
          />
          <FormatCard
            icon={LockKeyhole}
            title="Sealed bid"
            eyebrow="Private offers"
            description="Bids remain sealed during the auction. The authorized auction process opens them after closing, keeping offers private beforehand."
            points={["Offers stay hidden before opening", "The listing shows submission and closing rules"]}
          />
        </div>
      </section>

      {activeIssuers.length ? (
        <section aria-labelledby="issuers-title" className="space-y-5">
          <SectionHeader size="display"
          id="issuers-title"
            eyebrow="The organizations behind each notice"
            title="Issuing organizations"
            description="Every auction identifies the organization responsible for the notice and its requirements."
            action={<TextLink to="/auctions" label="Browse issuer listings" />}
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {activeIssuers.slice(0, 6).map((organization) => (
              <Link
                key={organization.id}
                to={`/auctions?orgId=${encodeURIComponent(organization.id)}`}
                className="group flex items-center gap-3 rounded-lg border bg-card p-4 shadow-xs transition-[border-color,box-shadow] hover:border-primary/35 hover:shadow-md"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-muted text-primary">
                  {organization.logoUrl ? (
                    <img src={organization.logoUrl} alt="" className="size-8 object-contain" />
                  ) : (
                    <Building2 className="size-5" aria-hidden="true" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{organization.name}</span>
                  <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="size-3" aria-hidden="true" /> {organization.region || "Ethiopia"}
                  </span>
                </span>
                <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-8 rounded-xl border bg-card p-6 shadow-xs sm:p-9 lg:grid-cols-[1fr_1fr] lg:p-12">
        <div>
          <p className="eyebrow text-primary">For public institutions</p>
          <h2 className="mt-3 max-w-lg text-3xl leading-tight font-semibold sm:text-4xl">A workspace for the people running the process.</h2>
          <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
            Prepare auction notices, manage lots and bidder readiness, record approvals, and publish outcomes through
            your organization workspace.
          </p>
          <Button asChild variant="outline" className="mt-6">
            <Link to="/login">Institution sign in <ArrowUpRight aria-hidden="true" /></Link>
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <ValueCard icon={FileSearch} title="Prepare notices" text="Set the auction format, dates, deposits, eligibility, and lot details." />
          <ValueCard icon={BadgeCheck} title="Review participation" text="Confirm bidder verification and review submitted bid security." />
          <ValueCard icon={Landmark} title="Keep decisions clear" text="Use separate roles for preparing and approving an auction." />
          <ValueCard icon={Banknote} title="Publish the outcome" text="Record the award or closure and make the public result available." />
        </div>
      </section>

      <section aria-labelledby="questions-title" className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr]">
        <div>
          <p className="eyebrow text-primary">Good to know</p>
          <h2 id="questions-title" className="mt-3 text-3xl font-semibold sm:text-4xl">Before you take part</h2>
          <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
            Start with the auction notice. It is the source for that sale&apos;s schedule, eligibility, deposit, and terms.
          </p>
          <Link to="/auctions#how-to-participate" className="mt-5 inline-flex items-center gap-2 rounded-sm text-sm font-medium text-primary underline-offset-4 hover:underline">
            Open participation guide <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
        <div className="divide-y rounded-lg border bg-card px-5 shadow-xs">
          <Faq title="Do all auctions require bid security?">
            Requirements vary by auction. Check the notice for the amount, accepted security types, and submission instructions.
          </Faq>
          <Faq title="What is identity verification for?">
            Bidder identity verification is required before placing bids. Once approved, it applies across auctions on the platform.
          </Faq>
          <Faq title="Where do I ask about an auction condition?">
            Contact the issuing organization named on that notice. If you believe an auction was run unfairly, you can raise a dispute from its auction page.
          </Faq>
        </div>
      </section>

      <section className="flex flex-col items-start justify-between gap-5 rounded-xl bg-accent p-6 text-accent-foreground sm:flex-row sm:items-center sm:p-9">
        <div>
          <p className="eyebrow text-accent-foreground/75">Start with the public catalogue</p>
          <h2 className="mt-2 text-2xl font-semibold text-accent-foreground sm:text-3xl">Find an auction. Read the details. Decide with confidence.</h2>
          <p className="mt-2 text-sm text-accent-foreground/75">Browse notices, upcoming auctions, and published results.</p>
        </div>
        <Button asChild size="lg" className="shrink-0">
          <Link to="/auctions">Explore the catalogue <ArrowRight aria-hidden="true" /></Link>
        </Button>
      </section>
    </div>
  );
}

function MetricLink({ to, label, value, note, loading }: { to: string; label: string; value: string; note: string; loading: boolean }) {
  return (
    <Link to={to} className="group flex items-center justify-between gap-4 px-5 py-5 transition-colors hover:bg-muted/50 focus-visible:ring-inset focus-visible:ring-offset-0 sm:px-7">
      <span>
        <span className="eyebrow block text-muted-foreground">{label}</span>
        <span className="mt-1 block text-sm text-foreground">{note}</span>
      </span>
      <span className={`text-3xl font-semibold tracking-tight text-primary tabular-nums ${loading ? "animate-pulse" : ""}`} aria-live="polite">{value}</span>
    </Link>
  );
}

function TextLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="inline-flex shrink-0 items-center gap-1 self-start rounded-sm text-sm font-medium text-primary underline-offset-4 hover:underline sm:self-auto">
      {label} <ArrowUpRight className="size-4" aria-hidden="true" />
    </Link>
  );
}

function FormatCard({ icon: Icon, title, eyebrow, description, points }: { icon: typeof Gavel; title: string; eyebrow: string; description: string; points: string[] }) {
  return (
    <Card className="p-6 sm:p-7">
      <div className="flex items-start gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div>
          <p className="eyebrow text-primary">{eyebrow}</p>
          <h3 className="mt-1 text-xl font-semibold">{title}</h3>
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-muted-foreground">{description}</p>
      <ul className="mt-4 space-y-2">
        {points.map((point) => (
          <li key={point} className="flex items-start gap-2 text-sm text-foreground/80">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" /> {point}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ValueCard({ icon: Icon, title, text }: { icon: typeof FileSearch; title: string; text: string }) {
  return (
    <div className="rounded-lg bg-muted/70 p-4 sm:p-5">
      <Icon className="size-5 text-primary" aria-hidden="true" />
      <h3 className="mt-3 font-semibold">{title}</h3>
      <p className="mt-1 text-sm leading-5 text-muted-foreground">{text}</p>
    </div>
  );
}

function Faq({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group py-4">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 rounded-sm font-medium marker:content-none [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <p className="mt-3 pr-8 text-sm leading-6 text-muted-foreground">{children}</p>
    </details>
  );
}

function categoryIcon(slug: string) {
  const normalized = slug.toLowerCase();
  if (normalized.includes("vehicle") || normalized.includes("car")) return CarFront;
  if (normalized.includes("machine") || normalized.includes("equipment")) return Truck;
  if (normalized.includes("property") || normalized.includes("land")) return Landmark;
  return Boxes;
}
