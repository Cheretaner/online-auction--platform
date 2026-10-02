import { Toaster as Sonner, type ToasterProps } from "sonner";
import { useTheme } from "@/theme-context";

export function Toaster(props: ToasterProps) {
  const { resolvedTheme } = useTheme();
  return (
    <Sonner
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: "group toast group-[.toaster]:rounded-lg group-[.toaster]:border-border group-[.toaster]:bg-card group-[.toaster]:font-sans group-[.toaster]:text-foreground group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
}
