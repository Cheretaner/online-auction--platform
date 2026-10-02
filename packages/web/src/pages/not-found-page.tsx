import { SearchX } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/context";

export default function NotFoundPage() {
  const t = useT("layout");
  return (
    <section className="mx-auto flex max-w-lg flex-col items-center gap-4 py-16 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-muted text-muted-foreground">
        <SearchX className="size-6" aria-hidden />
      </span>
      <p className="eyebrow text-primary">{t("notFound.eyebrow")}</p>
      <h1 className="text-3xl font-semibold">{t("notFound.title")}</h1>
      <p className="text-muted-foreground">
        {t("notFound.body")}
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link to="/auctions">{t("notFound.browse")}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/">{t("notFound.home")}</Link>
        </Button>
      </div>
    </section>
  );
}
