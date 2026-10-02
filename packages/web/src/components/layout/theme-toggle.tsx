import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/theme-context";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/context";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  const t = useT("common");
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={dark ? t("switchToLight") : t("switchToDark")}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {dark ? <Sun /> : <Moon />}
    </Button>
  );
}
