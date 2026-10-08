import { useEffect, useRef, useState, type FormEvent } from "react";
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
import heroVedio from "@/assets/cheretanet-hero-vedio.mp4"

import { useLocale, useT } from "@/i18n/context";
import { regionLabel } from "@/lib/format";

const participationSteps = [
  { number: "01", key: "find" },
  { number: "02", key: "prepare" },
  { number: "03", key: "requirements" },
  { number: "04", key: "follow" },
] as const;

/** Shared hover treatment for the home page's cards: small lift, green edge, deeper shadow. */
const cardHover =
  "transition-[transform,border-color,box-shadow,background-color] duration-300 ease-out hover:border-primary/35 hover:shadow-lg motion-safe:hover:-translate-y-0.5";
/** Icon tiles fill with the brand colour when their card is hovered. */
const iconTileHover =
  "transition-colors duration-300 group-hover:bg-primary group-hover:text-primary-foreground";

function formatCount(value: number | undefined, isLoading: boolean): string {
  return isLoading ? "—" : new Intl.NumberFormat("en-US").format(value ?? 0);
}

export default function HomePage() {
  const t = useT("home");
  const tc = useT("common");
  const { locale } = useLocale();
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
    <div className="w-full min-w-0 space-y-10 pb-8 sm:space-y-20 lg:space-y-24">
      <section className="relative isolate -mt-2 w-full min-w-0 overflow-hidden rounded-xl bg-[#0d0804] text-[#faf9f6] shadow-lg sm:-mt-4">
         <video
        src={heroVedio} 
        loop
        autoPlay
        muted
        playsInline
        className="absolute inset-0 -z-20 size-full object-cover object-center"
      >
        Your browser does not support the video tag.
      </video>
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#0d0804]/95 via-[#0d0804]/85 to-[#0d0804]/30 lg:to-[#0d0804]/10" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#0d0804]/70 via-transparent to-[#0d0804]/10" />

        <div className="grid w-full min-w-0 min-h-[440px] items-end gap-8 px-4 py-7 sm:min-h-[520px] sm:gap-10 sm:px-10 sm:py-12 lg:grid-cols-[1.1fr_0.65fr] lg:items-center lg:px-14 lg:py-16">
          <div className="min-w-0 max-w-2xl">
            <p className="eyebrow inline-flex items-center gap-2 text-highlight">
              <span className="relative flex size-2" aria-hidden="true">
                <span className="absolute inset-0 animate-ping rounded-full bg-highlight/60" />
                <span className="relative size-2 animate-pulse rounded-full bg-highlight" />
              </span>
              {t("hero.eyebrow")}
            </p>
            <h1 className="mt-5 max-w-2xl text-4xl leading-[1.06] font-semibold text-[#faf9f6] sm:text-5xl lg:text-6xl">
              {t("hero.title")}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-[#faf9f6]/80 sm:text-lg sm:leading-8">
              {t("hero.body", { app: locale === "am" ? tc("brandName") : APP_NAME })}
            </p>

            <form onSubmit={submitSearch} role="search" className="mt-6 flex w-full max-w-xl min-w-0 flex-col gap-2 rounded-lg bg-card p-2 shadow-xl sm:mt-8 sm:flex-row">
              <label htmlFor="home-auction-search" className="sr-only">{t("hero.searchLabel")}</label>
              <div className="flex min-w-0 flex-1 items-center gap-3 px-3">
                <Search className="size-5 shrink-0 text-[#746d65]" aria-hidden="true" />
                <input
                  id="home-auction-search"
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t("hero.searchPlaceholder")}
                  className="h-11 min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
                />
              </div>
              <Button type="submit" size="lg">
                {t("hero.searchButton")} <ArrowRight aria-hidden="true" />
              </Button>
            </form>

            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-[#faf9f6]/75">
              <Link to="/auctions?status=live" className="inline-flex items-center gap-1.5 rounded-sm hover:text-inverse-foreground">
                <span className="size-1.5 rounded-full bg-highlight" aria-hidden="true" /> {t("hero.viewLive")}
              </Link>
              <Link to="/auctions?status=scheduled" className="inline-flex items-center gap-1.5 rounded-sm hover:text-inverse-foreground">
                <Clock3 className="size-3.5" aria-hidden="true" /> {t("hero.viewUpcoming")}
              </Link>
            </div>
          </div>

          <div className="hidden justify-self-end lg:block">
            <ProcessCard />
          </div>
        </div>
      </section>

      <section aria-label={t("metrics.label")} className="grid divide-y overflow-hidden rounded-lg border bg-card shadow-xs sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <MetricLink
          to="/auctions?status=live"
          label={t("metrics.openLabel")}
          value={formatCount(live.data?.total, live.isLoading)}
          note={t("metrics.openNote")}
          loading={live.isLoading}
        />
        <MetricLink
          to="/auctions?status=scheduled"
          label={t("metrics.upcomingLabel")}
          value={formatCount(upcoming.data?.total, upcoming.isLoading)}
          note={t("metrics.upcomingNote")}
          loading={upcoming.isLoading}
        />
        <MetricLink
          to="/auctions?status=awarded"
          label={t("metrics.pastLabel")}
          value={formatCount(results.data?.total, results.isLoading)}
          note={t("metrics.pastNote")}
          loading={results.isLoading}
        />
      </section>

      <section aria-labelledby="live-auctions-title" className="space-y-5">
        <SectionHeader size="display"
          id="live-auctions-title"
          eyebrow={t("live.eyebrow")}
          title={t("live.title")}
          description={t("live.description")}
          action={<TextLink to="/auctions?status=live" label={t("live.browseAll")} />}
        />
        {live.isError ? (
          <Card className="flex flex-col items-start gap-3 border-dashed p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-semibold">{t("live.unavailableTitle")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t("live.unavailableBody")}</p>
            </div>
            <Button type="button" variant="outline" onClick={() => void live.refetch()}>{t("live.reload")}</Button>
          </Card>
        ) : live.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label={t("live.loading")}>
            {Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-72 rounded-lg" />)}
          </div>
        ) : liveAuctions.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {liveAuctions.map((auction) => <AuctionCard key={auction.id} auction={auction} />)}
          </div>
        ) : (
          <Card className="flex flex-col gap-4 border-dashed p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div>
              <h3 className="text-lg font-semibold">{t("live.emptyTitle")}</h3>
              <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
                {t("live.emptyBody")}
              </p>
            </div>
            <Button asChild variant="outline"><Link to="/auctions?status=scheduled">{t("live.viewUpcoming")}</Link></Button>
          </Card>
        )}
      </section>

      {visibleCategories.length ? (
        <section aria-labelledby="categories-title" className="space-y-5">
          <SectionHeader size="display"
          id="categories-title"
            eyebrow={t("categories.eyebrow")}
            title={t("categories.title")}
            description={t("categories.description")}
            action={<TextLink to="/auctions" label={t("categories.seeAll")} />}
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
                      {category.description || t("categories.fallback")}
                    </span>
                  </span>
                  <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="grid gap-10 rounded-xl bg-[#1F1B14] p-6 text-inverse-foreground sm:p-9 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:p-12" aria-labelledby="process-title">
        <div>
          <p className="eyebrow text-highlight-strong">{t("route.eyebrow")}</p>
          <h2 id="process-title" className="mt-3 max-w-md text-3xl leading-tight font-bold text-inverse-foreground sm:text-4xl">
            {t("route.title")}
          </h2>
          <p className="mt-4 max-w-md text-sm leading-6 text-inverse-foreground/75">
            {t("route.body")}
          </p>
          <Button asChild className="mt-6 bg-highlight-strong text-inverse hover:bg-highlight">
            <Link to="/auctions#how-to-participate">{t("route.guide")} <ArrowRight aria-hidden="true" /></Link>
          </Button>
        </div>
        <ParticipationSteps />
      </section>

      <section aria-labelledby="auction-formats-title" className="space-y-5">
        <SectionHeader size="display"
          id="auction-formats-title"
          eyebrow={t("formats.eyebrow")}
          title={t("formats.title")}
          description={t("formats.description")}
        />
        <div className="grid gap-4 md:grid-cols-2">
          <FormatCard
            icon={Gavel}
            title={t("formats.open.title")}
            eyebrow={t("formats.open.eyebrow")}
            description={t("formats.open.description")}
            points={[t("formats.open.point1"), t("formats.open.point2")]}
          />
          <FormatCard
            icon={LockKeyhole}
            title={t("formats.sealed.title")}
            eyebrow={t("formats.sealed.eyebrow")}
            description={t("formats.sealed.description")}
            points={[t("formats.sealed.point1"), t("formats.sealed.point2")]}
          />
        </div>
      </section>

      {activeIssuers.length ? (
        <section aria-labelledby="issuers-title" className="space-y-5">
          <SectionHeader size="display"
          id="issuers-title"
            eyebrow={t("issuers.eyebrow")}
            title={t("issuers.title")}
            description={t("issuers.description")}
            action={<TextLink to="/auctions" label={t("issuers.browse")} />}
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {activeIssuers.slice(0, 6).map((organization) => (
              <Link
                key={organization.id}
                to={`/auctions?orgId=${encodeURIComponent(organization.id)}`}
                className={`group flex items-center gap-3 rounded-lg border bg-card p-4 shadow-xs ${cardHover}`}
              >
                <span className={`flex size-11 shrink-0 items-center justify-center rounded-md bg-muted text-primary ${iconTileHover}`}>
                  {organization.logoUrl ? (
                    <img src={organization.logoUrl} alt="" className="size-8 object-contain" />
                  ) : (
                    <Building2 className="size-5" aria-hidden="true" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{organization.name}</span>
                  <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="size-3" aria-hidden="true" /> {regionLabel(organization.region || "Ethiopia")}
                  </span>
                </span>
                <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-[color,transform] duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-8 rounded-xl border bg-card p-6 shadow-xs sm:p-9 lg:grid-cols-[1fr_1fr] lg:p-12">
        <div>
          <p className="eyebrow text-primary">{t("institutions.eyebrow")}</p>
          <h2 className="mt-3 max-w-lg text-3xl leading-tight font-semibold sm:text-4xl">{t("institutions.title")}</h2>
          <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
            {t("institutions.body")}
          </p>
          <Button asChild variant="outline" className="mt-6">
            <Link to="/login">{t("institutions.signIn")} <ArrowUpRight aria-hidden="true" /></Link>
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <ValueCard icon={FileSearch} title={t("institutions.prepare.title")} text={t("institutions.prepare.text")} />
          <ValueCard icon={BadgeCheck} title={t("institutions.review.title")} text={t("institutions.review.text")} />
          <ValueCard icon={Landmark} title={t("institutions.decisions.title")} text={t("institutions.decisions.text")} />
          <ValueCard icon={Banknote} title={t("institutions.publish.title")} text={t("institutions.publish.text")} />
        </div>
      </section>

      <section aria-labelledby="questions-title" className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr]">
        <div>
          <p className="eyebrow text-primary">{t("faq.eyebrow")}</p>
          <h2 id="questions-title" className="mt-3 text-3xl font-semibold sm:text-4xl">{t("faq.title")}</h2>
          <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
            {t("faq.body")}
          </p>
          <Link to="/auctions#how-to-participate" className="mt-5 inline-flex items-center gap-2 rounded-sm text-sm font-medium text-primary underline-offset-4 hover:underline">
            {t("faq.guide")} <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
        <div className="divide-y overflow-hidden rounded-lg border bg-card px-5 shadow-xs">
          <Faq title={t("faq.q1")}>{t("faq.a1")}</Faq>
          <Faq title={t("faq.q2")}>{t("faq.a2")}</Faq>
          <Faq title={t("faq.q3")}>{t("faq.a3")}</Faq>
        </div>
      </section>

      <section className="flex flex-col items-start justify-between gap-5 rounded-xl bg-accent p-6 text-accent-foreground sm:flex-row sm:items-center sm:p-9">
        <div>
          <p className="eyebrow text-accent-foreground/75">{t("cta.eyebrow")}</p>
          <h2 className="mt-2 text-2xl font-semibold text-accent-foreground sm:text-3xl">{t("cta.title")}</h2>
          <p className="mt-2 text-sm text-accent-foreground/75">{t("cta.body")}</p>
        </div>
        <Button asChild size="lg" className="shrink-0">
          <Link to="/auctions">{t("cta.button")} <ArrowRight aria-hidden="true" /></Link>
        </Button>
      </section>
    </div>
  );
}

const PROCESS_STEPS = ["notice", "participate", "outcome"] as const;
const STEP_INTERVAL_MS = 1200;

/**
 * "One connected process" card. On hover the highlight walks 01 → 02 → 03
 * and loops; hovering a step selects it and pauses the walk there.
 * At rest it shows the finished state (03 checked).
 */
function ProcessCard() {
  const t = useT("home");
  // null = resting state; otherwise the highlighted step.
  const [active, setActive] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const reduceMotion = useRef(
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    if (active === null || paused || reduceMotion.current) return;
    const timer = setTimeout(() => setActive((step) => (step === null ? null : (step + 1) % PROCESS_STEPS.length)), STEP_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [active, paused]);

  return (
    <div
      className="w-64 rounded-lg border border-[#faf9f6]/15 bg-[#0d0804]/80 p-5 shadow-xl backdrop-blur-md transition-[border-color,box-shadow] duration-300 hover:border-highlight/40 hover:shadow-2xl"
      onMouseEnter={() => {
        setPaused(false);
        setActive(0);
      }}
      onMouseLeave={() => {
        setPaused(false);
        setActive(null);
      }}
    >
      <p className="eyebrow text-highlight">{t("process.title")}</p>
      <ol className="relative mt-5 space-y-4">
        {/* Connector behind the circles; fills up to the highlighted step. */}
        <span className="absolute top-4 bottom-4 left-4 w-px -translate-x-1/2 bg-[#faf9f6]/15" aria-hidden="true" />
        <span
          className="absolute top-4 left-4 w-px -translate-x-1/2 bg-highlight transition-[height] duration-500 ease-out"
          // Circles are 2rem tall with a 1rem gap, so step centres sit 3rem apart.
          style={{ height: `${(active ?? 0) * 3}rem` }}
          aria-hidden="true"
        />
        {PROCESS_STEPS.map((step, index) => {
          const label = t(`process.steps.${step}`);
          const resting = active === null;
          const isActive = resting ? index === PROCESS_STEPS.length - 1 : index === active;
          const isDone = !resting && active !== null && index < active;
          const isLast = index === PROCESS_STEPS.length - 1;
          return (
            <li
              key={label}
              className="relative flex cursor-default items-center gap-3"
              onMouseEnter={() => {
                setActive(index);
                setPaused(true);
              }}
              onMouseLeave={() => setPaused(false)}
            >
              <span
                className={`relative flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ease-out ${
                  isActive
                    ? "scale-110 bg-highlight text-[#0d0804] shadow-[0_0_0_4px_color-mix(in_oklch,var(--highlight)_25%,transparent)]"
                    : isDone
                      ? "border border-highlight bg-[#0d0804] text-highlight"
                      : "border border-inverse-foreground/25 bg-[#0d0804] text-[#faf9f6]"
                }`}
              >
                {isActive && !resting ? (
                  <span className="absolute inset-0 animate-ping rounded-full bg-highlight/40" aria-hidden="true" />
                ) : null}
                <span className="relative">
                  {isLast && isActive ? <Check className="size-4" aria-hidden="true" /> : `0${index + 1}`}
                </span>
              </span>
              <span
                className={`text-sm transition-colors duration-300 ${
                  isActive ? "font-medium text-[#faf9f6]" : "text-[#faf9f6]/75"
                }`}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-5 border-t border-[#faf9f6]/15 pt-4 text-xs leading-5 text-[#faf9f6]/65">
        {t("process.footnote")}
      </p>
    </div>
  );
}

/**
 * Four participation steps on the dark band. Clicking a step selects it: the
 * cell lights up and gold lines draw along the dividers that frame it.
 */
function ParticipationSteps() {
  const t = useT("home");
  const [selected, setSelected] = useState(0);
  return (
    <ol className="grid sm:grid-cols-2">
      {participationSteps.map((step, index) => {
        const isSelected = index === selected;
        const rightColumn = index % 2 === 1;
        return (
          <li
            key={step.number}
            className={`relative border-inverse-foreground/15 ${index > 0 ? "border-t" : ""} ${index === 1 ? "sm:border-t-0" : ""} ${rightColumn ? "sm:border-l" : ""}`}
          >
            {/* Horizontal divider highlight: draws left to right. */}
            <span
              className={`absolute inset-x-0 -top-px h-0.5 origin-left bg-highlight-strong transition-transform duration-500 ease-out ${
                isSelected ? "scale-x-100" : "scale-x-0"
              }`}
              aria-hidden="true"
            />
            {/* Vertical divider highlight on the right-hand column: draws top to bottom. */}
            {rightColumn ? (
              <span
                className={`absolute inset-y-0 -left-px hidden w-0.5 origin-top bg-highlight-strong transition-transform delay-150 duration-500 ease-out sm:block ${
                  isSelected ? "scale-y-100" : "scale-y-0"
                }`}
                aria-hidden="true"
              />
            ) : null}
            <button
              type="button"
              aria-pressed={isSelected}
              onClick={() => setSelected(index)}
              className={`block h-full w-full cursor-pointer px-1 py-5 text-left transition-colors duration-300 focus-visible:ring-highlight focus-visible:ring-offset-0 sm:px-6 ${
                isSelected ? "bg-inverse-foreground/[0.06]" : "hover:bg-inverse-foreground/[0.03]"
              }`}
            >
              <p
                className={`eyebrow inline-flex items-center gap-2 transition-colors duration-300 ${
                  isSelected ? "text-highlight-strong" : "text-highlight-strong"
                }`}
              >
                <span
                  className={`size-1.5 rounded-full bg-highlight transition-transform duration-300 ${isSelected ? "scale-100" : "scale-0"}`}
                  aria-hidden="true"
                />
                {t("route.step", { number: step.number })}
              </p>
              <h3
                className={`mt-2 text-lg font-semibold transition-colors duration-300 ${
                  isSelected ? "text-inverse-foreground" : "text-inverse-foreground/85"
                }`}
              >
                {t(`route.steps.${step.key}.title`)}
              </h3>
              <p
                className={`mt-2 text-sm leading-6 transition-colors duration-300 ${
                  isSelected ? "text-inverse-foreground/85" : "text-inverse-foreground/60"
                }`}
              >
                {t(`route.steps.${step.key}.text`)}
              </p>
            </button>
          </li>
        );
      })}
    </ol>
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
    <Card className={`group relative overflow-hidden p-6 sm:p-7 ${cardHover}`}>
      {/* Accent bar that draws across the top on hover. */}
      <span
        className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-primary transition-transform duration-500 ease-out group-hover:scale-x-100"
        aria-hidden="true"
      />
      <div className="flex items-start gap-4">
        <span className={`flex size-11 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary ${iconTileHover}`}>
          <Icon className="size-5 transition-transform duration-300 group-hover:scale-110" aria-hidden="true" />
        </span>
        <div>
          <p className="eyebrow text-primary">{eyebrow}</p>
          <h3 className="mt-1 text-xl font-semibold">{title}</h3>
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-muted-foreground">{description}</p>
      <ul className="mt-4 space-y-2">
        {points.map((point) => (
          <li key={point} className="flex items-start gap-2 text-sm text-foreground/80 transition-colors duration-300 group-hover:text-foreground">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" /> {point}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ValueCard({ icon: Icon, title, text }: { icon: typeof FileSearch; title: string; text: string }) {
  return (
    <div className={`group rounded-lg border border-transparent bg-muted/70 p-4 sm:p-5 hover:bg-card ${cardHover}`}>
      <span className={`flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary ${iconTileHover}`}>
        <Icon className="size-[18px]" aria-hidden="true" />
      </span>
      <h3 className="mt-3 font-semibold">{title}</h3>
      <p className="mt-1 text-sm leading-5 text-muted-foreground">{text}</p>
    </div>
  );
}

function Faq({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group relative -mx-5 px-5 transition-colors duration-300 open:bg-primary/[0.04] hover:bg-muted/50">
      {/* Accent bar on the open question. */}
      <span
        className="absolute inset-y-3 left-0 w-0.5 origin-top scale-y-0 rounded-full bg-primary transition-transform duration-300 group-open:scale-y-100"
        aria-hidden="true"
      />
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 rounded-sm py-4 font-medium transition-colors duration-200 marker:content-none group-hover:text-primary group-open:text-primary focus-visible:ring-offset-0 [&::-webkit-details-marker]:hidden">
        {title}
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full border text-muted-foreground transition-[background-color,border-color,color] duration-300 group-hover:border-primary/40 group-hover:text-primary group-open:border-primary group-open:bg-primary group-open:text-primary-foreground">
          <ChevronDown className="size-4 transition-transform duration-300 group-open:rotate-180" aria-hidden="true" />
        </span>
      </summary>
      {/* Replays each time the answer is revealed. */}
      <p className="animate-in fade-in-0 slide-in-from-top-1 pr-12 pb-5 text-sm leading-6 text-muted-foreground duration-300">
        {children}
      </p>
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
