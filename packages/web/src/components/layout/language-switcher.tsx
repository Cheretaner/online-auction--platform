import { Check, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DEFAULT_LOCALE, LOCALES } from "@/i18n/core";
import { useLocale, useT } from "@/i18n/context";
import { cn } from "@/lib/utils";

/** English / አማርኛ switch. The choice is remembered on this device. */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale } = useLocale();
  const t = useT("common");
  const current = LOCALES.find((entry) => entry.code === locale) ?? DEFAULT_LOCALE;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className={cn("gap-1.5 px-2.5", className)} aria-label={`${t("language")}: ${current.label}`}>
          <Languages aria-hidden />
          <span className="text-xs font-semibold">{current.short}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuLabel>{t("language")}</DropdownMenuLabel>
        {LOCALES.map((entry) => (
          <DropdownMenuItem key={entry.code} lang={entry.code} onClick={() => setLocale(entry.code)}>
            <span className="flex-1">{entry.label}</span>
            {entry.code === locale ? <Check className="text-primary" aria-hidden /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
