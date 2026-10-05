import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

/**
 * Top of every page: optional back link, title, one-line purpose and the page's
 * primary actions. Keep to one primary (filled) button in `actions`.
 */
export function PageHeader({
  title,
  description,
  actions,
  back,
  meta,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { to: string; label: string };
  /** Badges or facts shown under the title (status, type, region…). */
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("border-b border-border/70 pb-2  sm:pb-3", className)}>
      {back ? (
        <Link
          to={back.to}
          className="mb-3 inline-flex items-center gap-1.5 rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-2.5">
          <h1 className="text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">{title}</h1>
          {meta ? <div className="flex flex-wrap items-center gap-2">{meta}</div> : null}
          {description ? <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">{actions}</div> : null}
      </div>
    </header>
  );
}

/** Heading for a section inside a page. `display` is the larger, serif marketing style. */
export function SectionHeader({
  title,
  description,
  eyebrow,
  action,
  id,
  size = "default",
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: string;
  action?: ReactNode;
  id?: string;
  size?: "default" | "display";
  className?: string;
}) {
  const display = size === "display";
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="max-w-2xl min-w-0">
        {eyebrow ? <p className="eyebrow mb-2 text-primary">{eyebrow}</p> : null}
        <h2
          id={id}
          className={cn(
            "leading-tight font-semibold",
            display ? "text-3xl sm:text-4xl" : "text-xl",
          )}
        >
          {title}
        </h2>
        {description ? (
          <p className={cn("text-muted-foreground", display ? "mt-3 text-base leading-7" : "mt-1 text-sm leading-6")}>
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
