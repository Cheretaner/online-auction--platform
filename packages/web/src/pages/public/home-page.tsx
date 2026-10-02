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
import { AuctionCard } from "@/features/auctions/auction-card";
import { usePublicAuctions } from "@/features/auctions/queries";
import { useCategories, useOrganizations } from "@/features/operations/queries";
import { APP_NAME } from "@/config/env";
import heroVedio from "@/assets/cheretanet-hero-vedio.mp4"

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
    <div className="min-w-0 space-y-12 pb-8 sm:space-y-20 sm:pb-12 lg:space-y-24">
      <section className="relative isolate w-full min-w-0 overflow-hidden rounded-2xl bg-[#102f27] text-white shadow-2xl shadow-[#102f27]/15 sm:rounded-[2rem]">
        <video src={heroVedio} loop autoPlay muted
          playsInline className="absolute inset-0 -z-20 size-full object-cover object-center"
        >
          Your browser does not support the video tag.
        </video>
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#0b2a22]/90 via-[#0b2a22]/80 to-[#0b2a22]/55 lg:to-[#0b2a22]/10" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#0b2a22]/70 via-transparent to-[#0b2a22]/10" />

        <div className="grid w-full min-w-0 min-h-[min(680px,calc(100svh-6rem))] items-end gap-7 px-4 py-7 sm:min-h-[520px] sm:gap-10 sm:px-10 sm:py-12 lg:grid-cols-[1.1fr_0.65fr] lg:items-center lg:px-14 lg:py-16">
          <div className="min-w-0 max-w-2xl">
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#e5ce8a]">
              <span className="size-2 rounded-full bg-[#e5ce8a]" aria-hidden="true" />
              Public asset auctions · Ethiopia
            </p>
            <h1 className="mt-4 max-w-2xl font-heading text-[2.35rem] leading-[1.04] tracking-tight text-white sm:mt-5 sm:text-5xl lg:text-6xl">
              Every opportunity deserves a process people can follow.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-white/80 sm:text-lg sm:leading-8">
              {APP_NAME} brings auction notices, bidder participation, and published outcomes together—so people can
              see what is offered, understand what is required, and know what happens next.
            </p>

            <form onSubmit={submitSearch} className="mt-6 flex w-full max-w-xl flex-col gap-1.5 rounded-2xl bg-white p-2 shadow-xl sm:mt-8 sm:flex-row sm:gap-2">
              <label htmlFor="home-auction-search" className="sr-only">Search public auctions</label>
              <div className="flex min-w-0 flex-1 items-center gap-3 px-3">
                <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <input
                  id="home-auction-search"
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search vehicles, equipment, property..."
                  className="h-11 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
              </div>
              <Button type="submit" size="lg" className="w-full shrink-0 bg-[#174b3b] text-white hover:bg-[#103c30] sm:w-auto">
                Search auctions <ArrowRight aria-hidden="true" />
              </Button>
            </form>

            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-white/70">
              <Link to="/auctions?status=live" className="inline-flex items-center gap-1.5 hover:text-white">
                <span className="size-1.5 rounded-full bg-emerald-300" aria-hidden="true" /> View live auctions
              </Link>
              <Link to="/auctions?status=scheduled" className="inline-flex items-center gap-1.5 hover:text-white">
                <Clock3 className="size-3.5" aria-hidden="true" /> See upcoming auctions
              </Link>
            </div>
          </div>

          <div className="w-full justify-self-end lg:w-auto">
            <div className="rounded-2xl border border-white/20 bg-[#102f27]/75 p-4 text-white shadow-xl backdrop-blur-md backdrop-saturate-150 sm:p-5 lg:w-64">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#e5ce8a]">One connected process</p>
              <div className="mt-3 grid grid-cols-3 gap-2 sm:mt-5 sm:space-y-4 lg:block">
                {[
                  ["01", "Notice published"],
                  ["02", "Bidders participate"],
                  ["03", "Outcome recorded"],
                ].map(([number, label], index) => (
                  <div key={number} className="flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3 lg:mb-4">
                    <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold sm:size-8 sm:text-xs ${index === 2 ? "bg-[#d5ba70] text-[#18372e]" : "border border-white/25 text-white"}`}>
                      {index === 2 ? <Check className="size-4" aria-hidden="true" /> : number}
                    </span>
                    <span className="text-[11px] leading-4 text-white/90 sm:text-sm">{label}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 hidden border-t border-white/15 pt-4 text-xs leading-5 text-white/65 sm:block sm:mt-5">
                Clear information for bidders. A traceable workspace for institutions.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section aria-label="Auction activity" className="grid overflow-hidden rounded-2xl border bg-card sm:grid-cols-3">
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
        <SectionHeading
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
            {Array.from({ length: 3 }, (_, index) => <div key={index} className="h-72 animate-pulse rounded-xl border bg-muted/60" />)}
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
          <SectionHeading
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
                  className="group flex min-h-28 items-center gap-4 rounded-2xl border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:p-5"
                >
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
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

      <section className="grid gap-10 rounded-[2rem] bg-[#12392f] p-6 text-white sm:p-9 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:p-12" aria-labelledby="process-title">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#e5ce8a]">A clear route to participation</p>
          <h2 id="process-title" className="mt-3 max-w-md font-heading text-3xl leading-tight text-white sm:text-4xl">
            Know what is expected before you place a bid.
          </h2>
          <p className="mt-4 max-w-md text-sm leading-6 text-white/75">
            The requirements are shown with each auction. Take time to read them: verification, bid security, and timing
            can vary from one notice to another.
          </p>
          <Button asChild className="mt-6 bg-[#d5ba70] text-[#18372e] hover:bg-[#e2cb89]">
            <Link to="/auctions#how-to-participate">Read the bidder guide <ArrowRight aria-hidden="true" /></Link>
          </Button>
        </div>
        <ol className="grid gap-0 sm:grid-cols-2">
          {participationSteps.map((step, index) => (
            <li key={step.number} className={`border-white/15 py-5 ${index < 2 ? "border-b" : ""} ${index % 2 === 0 ? "sm:pr-6" : "sm:border-l sm:pl-6"}`}>
              <p className="font-mono text-xs font-semibold tracking-widest text-[#e5ce8a]">STEP {step.number}</p>
              <h3 className="mt-2 font-semibold text-white">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-white/70">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="auction-formats-title" className="space-y-5">
        <SectionHeading
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
          <SectionHeading
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
                className="group flex items-center gap-3 rounded-2xl border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-muted/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-primary">
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

      <section className="grid gap-8 rounded-[2rem] border bg-card p-6 sm:p-9 lg:grid-cols-[1fr_1fr] lg:p-12">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">For public institutions</p>
          <h2 className="mt-3 max-w-lg font-heading text-3xl leading-tight sm:text-4xl">A workspace for the people running the process.</h2>
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
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Good to know</p>
          <h2 id="questions-title" className="mt-3 font-heading text-3xl">Before you take part</h2>
          <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
            Start with the auction notice. It is the source for that sale&apos;s schedule, eligibility, deposit, and terms.
          </p>
          <Link to="/auctions#how-to-participate" className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
            Open participation guide <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
        <div className="divide-y rounded-2xl border bg-card px-5">
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

      <section className="flex flex-col items-start justify-between gap-5 rounded-[2rem] bg-[#e9dfc3] p-6 text-[#24352d] sm:flex-row sm:items-center sm:p-9">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#496453]">Start with the public catalogue</p>
          <h2 className="mt-2 font-heading text-2xl sm:text-3xl">Find an auction. Read the details. Decide with confidence.</h2>
          <p className="mt-2 text-sm text-[#496453]">Browse notices, upcoming auctions, and published results.</p>
        </div>
        <Button asChild className="shrink-0 bg-[#174b3b] text-white hover:bg-[#103c30]">
          <Link to="/auctions">Explore the catalogue <ArrowRight aria-hidden="true" /></Link>
        </Button>
      </section>
    </div>
  );
}

function MetricLink({ to, label, value, note, loading }: { to: string; label: string; value: string; note: string; loading: boolean }) {
  return (
    <Link to={to} className="group flex items-center justify-between gap-4 px-5 py-5 transition-colors hover:bg-muted/50 sm:px-7">
      <span>
        <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
        <span className="mt-1 block text-sm text-foreground">{note}</span>
      </span>
      <span className={`text-3xl font-semibold tracking-tight text-primary ${loading ? "animate-pulse" : ""}`} aria-live="polite">{value}</span>
    </Link>
  );
}

function SectionHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
        <h2 className="mt-2 font-heading text-3xl leading-tight sm:text-4xl">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

function TextLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="inline-flex shrink-0 items-center gap-1 self-start text-sm font-medium text-primary hover:underline sm:self-auto">
      {label} <ArrowUpRight className="size-4" aria-hidden="true" />
    </Link>
  );
}

function FormatCard({ icon: Icon, title, eyebrow, description, points }: { icon: typeof Gavel; title: string; eyebrow: string; description: string; points: string[] }) {
  return (
    <Card className="p-6 sm:p-7">
      <div className="flex items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">{eyebrow}</p>
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
    <div className="rounded-2xl bg-muted/60 p-4 sm:p-5">
      <Icon className="size-5 text-primary" aria-hidden="true" />
      <h3 className="mt-3 font-semibold">{title}</h3>
      <p className="mt-1 text-sm leading-5 text-muted-foreground">{text}</p>
    </div>
  );
}

function Faq({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group py-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium marker:content-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
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
