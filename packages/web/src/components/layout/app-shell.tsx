import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { APP_SHORT_NAME } from "@/config/env";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { OfflineBanner } from "@/components/feedback/query-state";
import { OrgSwitcher } from "@/components/layout/org-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { getAppNav } from "@/components/layout/nav-items";
import { useAuth } from "@/features/auth/auth-provider";
import { useUnreadCount } from "@/features/operations/queries";
import { cn } from "@/lib/utils";

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { roles } = useAuth();
  const unread = useUnreadCount(true);
  const items = getAppNav(roles);
  return (
    <nav className="flex flex-col gap-1 p-2">
      {items.map((item) => {
        const Icon = item.icon;
        const count = item.to === "/app/notifications" ? unread.data?.count : undefined;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.match === "exact"}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "flex min-h-10 items-center gap-3 rounded-md px-3 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
              )
            }
          >
            <Icon className="size-4 shrink-0" />
            <span className="flex-1">{item.label}</span>
            {count ? (
              <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">{count}</span>
            ) : null}
          </NavLink>
        );
      })}
    </nav>
  );
}

export function AppShell() {
  const [online, setOnline] = useState(navigator.onLine);
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { session } = useAuth();

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

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex min-h-svh bg-background">
      <aside className="hidden w-64 shrink-0 bg-sidebar text-sidebar-foreground lg:flex lg:flex-col">
        <div className="flex h-16 items-center px-4">
          <Link to="/" className="font-heading text-lg font-semibold">
            {APP_SHORT_NAME}
          </Link>
        </div>
        <Separator className="bg-sidebar-border" />
        <ScrollArea className="flex-1">
          <NavLinks />
        </ScrollArea>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <OfflineBanner online={online} />
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-background/90 px-3 backdrop-blur md:px-6">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-sidebar p-0 text-sidebar-foreground">
              <SheetHeader className="p-4">
                <SheetTitle className="text-sidebar-foreground">{APP_SHORT_NAME}</SheetTitle>
              </SheetHeader>
              <NavLinks onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <div className="hidden md:block">
            <OrgSwitcher />
          </div>
          <div className="ml-auto flex items-center gap-1">
            {session?.organizationId ? null : session?.organizations.length ? (
              <span className="hidden text-xs text-destructive md:inline">Org context required</span>
            ) : null}
            <ThemeToggle />
            <UserMenu />
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-3 py-6 md:px-6">
          <div className="mb-4 md:hidden">
            <OrgSwitcher />
          </div>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
