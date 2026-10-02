import { Link, Outlet } from "react-router-dom";
import { Footer } from "@/components/layout/Footer";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import logo from "../../assets/images/cheretanet-full-logo.png";

export function PublicShell() {
  return (
    <div className="flex min-h-svh w-full flex-col overflow-x-clip bg-background">
      <header className="sticky top-0 z-30 w-full border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex min-h-14 w-full max-w-7xl items-center gap-2 px-3 sm:h-16 sm:gap-3 sm:px-4">
          <Link to="/" className="flex h-14 w-[104px] shrink-0 items-center sm:h-16 sm:w-[136px]">
            <img src={logo} alt="Cheretanet home" className="block h-auto max-h-11 w-full object-contain sm:max-h-12" />
          </Link>
          <nav className="flex min-w-0 items-center gap-2 text-xs sm:ml-4 sm:gap-4 sm:text-sm" aria-label="Public navigation">
            <Link to="/auctions" className="whitespace-nowrap text-muted-foreground hover:text-foreground sm:hidden">
              Auctions
            </Link>
            <Link to="/auctions" className="hidden whitespace-nowrap text-muted-foreground hover:text-foreground sm:inline">
              Browse auctions
            </Link>
            <Link to="/auctions#how-to-participate" className="hidden whitespace-nowrap text-muted-foreground hover:text-foreground sm:inline">
              How it works
            </Link>
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full min-w-0 max-w-7xl flex-1 px-3 py-5 sm:px-4 sm:py-8">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
