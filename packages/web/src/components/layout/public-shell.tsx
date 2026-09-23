import { Link, Outlet } from "react-router-dom";
import { APP_SHORT_NAME } from "@/config/env";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";

export function PublicShell() {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4">
          <Link to="/" className="font-heading text-lg font-semibold">
            {APP_SHORT_NAME}
          </Link>
          <nav className="ml-4 hidden items-center gap-4 text-sm md:flex">
            <Link to="/auctions" className="text-muted-foreground hover:text-foreground">
              Auctions
            </Link>
            <Link to="/login" className="text-muted-foreground hover:text-foreground">
              Sign in
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Button asChild size="sm" className="hidden sm:inline-flex">
              <Link to="/register">Create account</Link>
            </Button>
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        Transparent public auctions for Ethiopia
      </footer>
    </div>
  );
}
