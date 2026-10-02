import { ArrowRight, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** One headline number with its label. With `href` the whole card is a link. */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  href,
  loading = false,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  href?: string;
  loading?: boolean;
  className?: string;
}) {
  const body = (
    <Card interactive={Boolean(href)} className={cn("flex h-full flex-col p-5", className)} aria-busy={loading}>
      <div className="flex items-start justify-between gap-3">
        <p className="eyebrow text-muted-foreground">{label}</p>
        {Icon ? (
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <Icon className="size-4" aria-hidden />
          </span>
        ) : null}
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-20" />
      ) : (
        <p className="mt-2 text-2xl font-semibold tracking-tight capitalize tabular-nums">{value}</p>
      )}
      {hint ? (
        <p className="mt-auto flex items-center justify-between gap-2 pt-4 text-xs text-muted-foreground">
          <span>{hint}</span>
          {href ? <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden /> : null}
        </p>
      ) : null}
    </Card>
  );
  if (!href) return body;
  return (
    <Link to={href} className="group block rounded-lg focus-visible:ring-offset-2">
      {body}
    </Link>
  );
}
