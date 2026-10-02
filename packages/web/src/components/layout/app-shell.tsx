import { Link, NavLink, Outlet } from "react-router-dom";
import { ArrowUpRight, Bell, Menu } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { OfflineBanner } from "@/components/feedback/query-state";
import { BrandLogo } from "@/components/layout/brand-logo";
import { OrgSwitcher } from "@/components/layout/org-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { getAppNav, NAV_GROUPS } from "@/components/layout/nav-items";
import { useAuth } from "@/features/auth/auth-provider";
import { useUnreadCount } from "@/features/operations/queries";
import { cn } from "@/lib/utils";

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { roles } = useAuth();
  const unread = useUnreadCount(true);
  const items = getAppNav(roles);
  return (
    <nav aria-label="Workspace" className="flex flex-col gap-5 px-3 py-4">
      {NAV_GROUPS.map((group) => {
        const groupItems = items.filter((item) => item.group === group);
        if (groupItems.length === 0) return null;
        return (
          <div key={group}>
            {group !== "Overview" ? (
              <p className="eyebrow mb-1.5 px-3 text-sidebar-foreground/50">{group}</p>
            ) : null}
            <ul className="flex flex-col gap-0.5">
              {groupItems.map((item) => {
                const Icon = item.icon;
                const count = item.to === "/app/notifications" ? unread.data?.count : undefined;
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.match === "exact"}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        cn(
                          "relative flex min-h-10 items-center gap-3 rounded-md px-3 text-sm text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground focus-visible:ring-highlight focus-visible:ring-offset-sidebar",
                          isActive &&
                            "bg-sidebar-accent font-medium text-sidebar-accent-foreground before:absolute before:inset-y-2 before:-left-3 before:w-1 before:rounded-r-full before:bg-highlight",
                        )
                      }
                    >
                      <Icon className="size-4 shrink-0" aria-hidden />
                      <span className="flex-1 truncate">{item.label}</span>
                      {count ? (
                        <span className="min-w-5 rounded-full bg-highlight px-1.5 text-center text-xs leading-5 font-semibold text-inverse">
                          {count}
                          <span className="sr-only"> unread</span>
                        </span>
                      ) : null}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

/**
 * The sidebar's own scroll region. `overscroll-contain` keeps the wheel/touch
 * scroll inside the sidebar instead of handing it to the page at either end.
 */
function SidebarScroll({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-color:var(--sidebar-accent)_transparent] [scrollbar-gutter:stable] [scrollbar-width:thin]">
      {children}
    </div>
  );
}

function SidebarFooter() {
  return (
    <div className="shrink-0 border-t border-sidebar-border p-3">
      <Link
        to="/auctions"
        className="flex min-h-10 items-center justify-between rounded-md px-3 text-sm text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground focus-visible:ring-highlight focus-visible:ring-offset-sidebar"
      >
        Public auction site
        <ArrowUpRight className="size-4" aria-hidden />
      </Link>
    </div>
  );
}

function NotificationsButton() {
  const unread = useUnreadCount(true);
  const count = unread.data?.count ?? 0;
  return (
    <Button asChild variant="ghost" size="icon" className="relative">
      <Link to="/app/notifications" aria-label={count ? `Notifications, ${count} unread` : "Notifications"}>
        <Bell />
        {count ? (
          <span className="absolute top-2 right-2 size-2 rounded-full bg-destructive ring-2 ring-background" aria-hidden />
        ) : null}
      </Link>
    </Button>
  );
}

export function AppShell() {
  const [online, setOnline] = useState(navigator.onLine);
  const [open, setOpen] = useState(false);
  const { session } = useAuth();
  const needsOrg = !session?.organizationId && (session?.organizations.length ?? 0) > 0;

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return (
    <div className="flex min-h-svh bg-background">
      <aside className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <div className="flex h-16 shrink-0 items-center border-b border-sidebar-border px-5">
          <BrandLogo tone="inverse" to="/app" className="focus-visible:ring-highlight focus-visible:ring-offset-sidebar" />
        </div>
        <SidebarScroll>
          <SidebarNav />
        </SidebarScroll>
        <SidebarFooter />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <a
          href="#main-content"
          className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground focus:not-sr-only focus:absolute focus:top-2 focus:left-2"
        >
          Skip to content
        </a>
        <OfflineBanner online={online} />
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/85 sm:px-6 lg:px-8">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="-ml-2 lg:hidden" aria-label="Open navigation">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-72 gap-0 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground"
            >
              <div className="flex h-16 shrink-0 items-center border-b border-sidebar-border px-5">
                <SheetTitle className="sr-only">Workspace navigation</SheetTitle>
                <SheetDescription className="sr-only">Pages available to your account</SheetDescription>
                <BrandLogo tone="inverse" to="/app" />
              </div>
              <SidebarScroll>
                <SidebarNav onNavigate={() => setOpen(false)} />
              </SidebarScroll>
              <SidebarFooter />
            </SheetContent>
          </Sheet>
          <div className="lg:hidden">
            <BrandLogo to="/app" compact />
          </div>
          <div className="hidden md:block">
            <OrgSwitcher />
          </div>
          {needsOrg ? (
            <Badge variant="warning" className="hidden md:inline-flex">
              Choose an organization to manage auctions
            </Badge>
          ) : null}
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <NotificationsButton />
            <UserMenu />
          </div>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 outline-none sm:px-6 sm:py-8 lg:px-8"
        >
          <div className="mb-5 md:hidden">
            <OrgSwitcher />
          </div>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
