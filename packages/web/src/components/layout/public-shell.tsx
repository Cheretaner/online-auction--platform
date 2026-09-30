import { Link, Outlet } from "react-router-dom";
import { Footer } from "@/components/layout/Footer";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import logo from "../../assets/images/cheretanet-full-logo.png";

export function PublicShell() {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4">
          <Link to="/" className="flex h-16 w-[136px] shrink-0 items-center">
            <img src={logo} alt="Cheretanet home" className="block h-auto max-h-12 w-full object-contain" />
          </Link>
          <nav className="ml-1 flex items-center gap-3 text-xs sm:ml-4 sm:gap-4 sm:text-sm" aria-label="Public navigation">
            <Link to="/auctions" className="whitespace-nowrap text-muted-foreground hover:text-foreground">
              Browse auctions
            </Link>
            <Link to="/auctions#how-to-participate" className="hidden whitespace-nowrap text-muted-foreground hover:text-foreground sm:inline">
              How it works
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
