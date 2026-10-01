import { SearchX } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  return (
    <section className="mx-auto flex max-w-lg flex-col items-center gap-4 py-16 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-muted text-muted-foreground">
        <SearchX className="size-6" aria-hidden />
      </span>
      <p className="eyebrow text-primary">Error 404</p>
      <h1 className="text-3xl font-semibold">Page not found</h1>
      <p className="text-muted-foreground">
        This address does not match a page on Cheretanet. It may have moved, or the link may be incomplete.
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link to="/auctions">Browse auctions</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/">Go to home page</Link>
        </Button>
      </div>
    </section>
  );
}
