import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/context";

export function Pagination({
  page,
  pages,
  total,
  noun,
  onChange,
}: {
  page: number;
  pages: number;
  total?: number;
  noun?: string;
  onChange: (page: number) => void;
}) {
  const t = useT("common");
  if (pages <= 1) return null;
  return (
    <nav className="flex items-center justify-between gap-3 pt-2" aria-label={t("pagination")}>
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        <ChevronLeft aria-hidden /> {t("previous")}
      </Button>
      <p className="text-center text-sm text-muted-foreground" aria-live="polite">
        {t("page", { page, pages })}
        {total !== undefined ? <span className="hidden sm:inline"> · {total} {noun ?? t("results")}</span> : null}
      </p>
      <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>
        {t("next")} <ChevronRight aria-hidden />
      </Button>
    </nav>
  );
}
