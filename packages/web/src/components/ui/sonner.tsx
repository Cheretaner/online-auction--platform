import { Toaster as Sonner, type ToasterProps } from "sonner";
import { useTheme } from "@/theme-context";

export function Toaster(props: ToasterProps) {
  const { resolvedTheme } = useTheme();
  return (
    <Sonner
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      className="toaster group"
      closeButton
      richColors
      expand
      visibleToasts={5}
      duration={6000}
      toastOptions={{
        classNames: {
          toast: "group toast group-[.toaster]:rounded-lg group-[.toaster]:border-border group-[.toaster]:bg-card group-[.toaster]:font-sans group-[.toaster]:text-foreground group-[.toaster]:shadow-lg group-[.toaster]:data-[type=success]:border-emerald-500/40 group-[.toaster]:data-[type=error]:border-destructive/40 group-[.toaster]:data-[type=warning]:border-amber-500/40",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-foreground",
          closeButton: "group-[.toast]:border-border group-[.toaster]:bg-background group-[.toaster]:text-foreground",
        },
      }}
      containerAriaLabel="Notifications"
      {...props}
    />
  );
}
