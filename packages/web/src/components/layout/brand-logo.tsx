import { Link } from "react-router-dom";
import mark from "@/assets/images/cheretanet.png";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/context";

/**
 * Cheretanet lockup: the emblem on a white tile plus a live-text wordmark.
 * The tile keeps the navy emblem legible on dark surfaces (sidebar, footer,
 * dark mode), where the flat logo image would disappear.
 */
export function BrandLogo({
  to = "/",
  tone = "default",
  compact = false,
  className,
}: {
  to?: string;
  /** `inverse` for dark bands (footer, workspace sidebar). */
  tone?: "default" | "inverse";
  /** Emblem only on phones, where header space is tight. */
  compact?: boolean;
  className?: string;
}) {
  const t = useT("layout");
  return (
    <Link
      to={to}
      aria-label={t("header.home")}
      className={cn("inline-flex shrink-0 items-center gap-2.5 rounded-md", className)}
    >
      <span className="grid size-9 place-items-center rounded-md bg-white p-1 shadow-xs ring-1 ring-black/5">
        <img src={mark} alt="" className="size-full object-contain" />
      </span>
      <span
        className={cn(
          "text-[19px] leading-none font-bold tracking-[-0.02em]",
          compact && "hidden sm:inline",
          tone === "inverse" ? "text-inverse-foreground" : "text-foreground",
        )}
        aria-hidden
      >
        chereta
        <span className={tone === "inverse" ? "text-highlight" : "text-primary"}>net</span>
      </span>
    </Link>
  );
}
