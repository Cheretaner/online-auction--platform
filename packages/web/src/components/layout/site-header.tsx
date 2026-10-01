import { useEffect, useState } from "react";
import { Clock, HelpCircle, LayoutDashboard, Menu, Search } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { BrandLogo } from "@/components/layout/brand-logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { useAuth } from "@/features/auth/auth-provider";
import { cn } from "@/lib/utils";

type NavKey = "browse" | "live" | "results" | "guide";

const NAV: Array<{ key: NavKey; label: string; to: string }> = [
  { key: "browse", label: "Browse auctions", to: "/auctions" },
  { key: "live", label: "Live now", to: "/auctions?status=live" },
  { key: "results", label: "Results", to: "/auctions?status=awarded" },
  { key: "guide", label: "How it works", to: "/auctions#how-to-participate" },
];

/** Which public nav item the current URL belongs to. */
function useActiveNav(): NavKey | null {
  const { pathname, search, hash } = useLocation();
  if (!pathname.startsWith("/auctions")) return null;
  if (hash === "#how-to-participate") return "guide";
  const status = new URLSearchParams(search).get("status");
  if (pathname === "/auctions" && status === "live") return "live";
  if (pathname === "/auctions" && status === "awarded") return "results";
  return "browse";
}

function useAddisClock() {
  const format = () =>
    new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Addis_Ababa", hour: "2-digit", minute: "2-digit" }).format(
      new Date(),
    );
  const [time, setTime] = useState(format);
  useEffect(() => {
    const timer = setInterval(() => setTime(format()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return time;
}

function UtilityBar() {
  const time = useAddisClock();
  return (
    <div className="hidden border-b bg-muted/60 md:block">
      <div className="page-container flex h-8 items-center justify-between text-xs text-muted-foreground">
        <p className="inline-flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-primary" aria-hidden />
          Transparent public auction portal · Ethiopia
        </p>
        <div className="flex items-center gap-4">
          <p className="inline-flex items-center gap-1.5">
            <Clock className="size-3.5" aria-hidden />
            <span className="font-mono tabular-nums">EAT {time}</span>
            <span className="hidden lg:inline">(Addis Ababa)</span>
          </p>
          <span className="h-3 w-px bg-border" aria-hidden />
          <Link to="/auctions#how-to-participate" className="inline-flex items-center gap-1.5 hover:text-foreground">
            <HelpCircle className="size-3.5" aria-hidden />
            How it works
          </Link>
        </div>
      </div>
    </div>
  );
}

function SearchBox({ className }: { className?: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const current = new URLSearchParams(location.search).get("q") ?? "";
  const [value, setValue] = useState(current);
  // Follow the URL when it changes elsewhere (a tab, the back button),
  // using React's "adjust state during render" pattern.
  const [synced, setSynced] = useState(current);
  if (current !== synced) {
    setSynced(current);
    setValue(current);
  }

  // Debounced: typing updates the listing without a request per keystroke.
  useEffect(() => {
    if (value === current) return;
    const timer = setTimeout(() => {
      const params = new URLSearchParams(location.pathname === "/auctions" ? location.search : "");
      if (value.trim()) params.set("q", value.trim());
      else params.delete("q");
      params.delete("page");
      const search = params.toString();
      navigate(`/auctions${search ? `?${search}` : ""}`, { replace: location.pathname === "/auctions" });
    }, 350);
    return () => clearTimeout(timer);
  }, [value, current, location.pathname, location.search, navigate]);

  return (
    <div role="search" className={cn("relative", className)}>
      <label htmlFor="site-search" className="sr-only">
        Search auctions
      </label>
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <input
        id="site-search"
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search auctions and tenders…"
        className="h-10 w-full rounded-md border border-input bg-card pr-3 pl-9 text-sm shadow-xs outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/80 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 focus-visible:ring-offset-0"
      />
    </div>
  );
}

function NavLinks({ orientation, onNavigate }: { orientation: "row" | "column"; onNavigate?: () => void }) {
  const active = useActiveNav();
  return (
    <ul className={cn("flex", orientation === "row" ? "items-center gap-1" : "flex-col gap-1")}>
      {NAV.map((item) => {
        const isActive = active === item.key;
        return (
          <li key={item.key}>
            <Link
              to={item.to}
              onClick={onNavigate}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex items-center rounded-md text-sm font-medium whitespace-nowrap transition-colors",
                orientation === "row"
                  ? "h-10 px-3 text-muted-foreground hover:bg-muted hover:text-foreground"
                  : "h-11 px-3 text-foreground hover:bg-muted",
                isActive &&
                  (orientation === "row"
                    ? "text-foreground after:absolute after:inset-x-3 after:-bottom-[13px] after:h-0.5 after:rounded-full after:bg-primary"
                    : "bg-primary/10 text-primary hover:bg-primary/10"),
              )}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function MobileMenu() {
  const [open, setOpen] = useState(false);
  const { isAuthenticated } = useAuth();
  const close = () => setOpen(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-80 max-w-[85vw] gap-6">
        <SheetHeader>
          <SheetTitle>Menu</SheetTitle>
          <SheetDescription className="sr-only">Site navigation and account actions</SheetDescription>
        </SheetHeader>
        <nav aria-label="Main">
          <NavLinks orientation="column" onNavigate={close} />
        </nav>
        <div className="mt-auto flex flex-col gap-2 border-t pt-5">
          {isAuthenticated ? (
            <Button asChild>
              <Link to="/app" onClick={close}>
                <LayoutDashboard aria-hidden /> Open workspace
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild>
                <Link to="/register" onClick={close}>
                  Register as bidder
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/login" onClick={close}>
                  Sign in
                </Link>
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

const NO_RETURN = new Set(["/", "/login", "/register", "/forgot-password", "/reset-password"]);

export function SiteHeader() {
  const { isAuthenticated } = useAuth();
  const { pathname, search } = useLocation();
  // After signing in, come back to the auction or listing the visitor was reading.
  const signInState = NO_RETURN.has(pathname) ? undefined : { from: `${pathname}${search}` };
  // The home page has its own large search in the hero.
  const showSearch = pathname !== "/";

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground focus:not-sr-only focus:absolute focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <UtilityBar />
      <div className="page-container flex h-16 items-center gap-4 lg:gap-6">
        <BrandLogo />
        <nav aria-label="Main" className="hidden lg:block">
          <NavLinks orientation="row" />
        </nav>
        {showSearch ? <SearchBox className="ml-auto hidden w-full max-w-xs md:block xl:max-w-sm" /> : null}
        <div className={cn("flex items-center gap-1 sm:gap-2", !showSearch && "ml-auto", showSearch && "ml-auto md:ml-0")}>
          <ThemeToggle />
          {isAuthenticated ? (
            <>
              <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
                <Link to="/app">
                  <LayoutDashboard aria-hidden /> Workspace
                </Link>
              </Button>
              <UserMenu />
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link to="/login" state={signInState}>
                  Sign in
                </Link>
              </Button>
              <Button asChild size="sm" className="hidden sm:inline-flex">
                <Link to="/register">Register as bidder</Link>
              </Button>
            </>
          )}
          <MobileMenu />
        </div>
      </div>
      {showSearch ? (
        <div className="page-container pb-3 md:hidden">
          <SearchBox />
        </div>
      ) : null}
    </header>
  );
}
