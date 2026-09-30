import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  return (
    <main className="grid min-h-svh place-content-center gap-4 p-6 text-center">
      <p className="text-sm font-medium text-primary">404</p>
      <h1 className="text-3xl">Page not found</h1>
      <p className="text-muted-foreground">
        This address does not match a page in the application.
      </p>
      <Button asChild>
        <Link to="/">Return home</Link>
      </Button>
    </main>
  );
}
