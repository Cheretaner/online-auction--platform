import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Pagination({
  page,
  pages,
  total,
  noun = "results",
  onChange,
}: {
  page: number;
  pages: number;
  total?: number;
  noun?: string;
  onChange: (page: number) => void;
}) {
  if (pages <= 1) return null;
  return (
    <nav className="flex items-center justify-between gap-3 pt-2" aria-label="Pagination">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        <ChevronLeft aria-hidden /> Previous
      </Button>
      <p className="text-center text-sm text-muted-foreground" aria-live="polite">
        Page <span className="font-medium text-foreground">{page}</span> of {pages}
        {total !== undefined ? <span className="hidden sm:inline"> · {total} {noun}</span> : null}
      </p>
      <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>
        Next <ChevronRight aria-hidden />
      </Button>
    </nav>
  );
}
