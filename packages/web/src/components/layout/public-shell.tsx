import { Outlet } from "react-router-dom";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

/** Public site frame: one header, one footer, one content width for every public page. */
export function PublicShell() {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="page-container flex-1 py-8 outline-none sm:py-10">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}
