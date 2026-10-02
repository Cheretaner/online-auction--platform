import { ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { fieldBase } from "./field-styles";

/** Browser <select> with the shared field styling. Use it where a plain value list is enough
 * (filters, long lists); use the Radix Select inside react-hook-form fields. */
export function NativeSelect({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <div className={cn("relative", className)}>
      <select className={cn(fieldBase, "h-10 cursor-pointer appearance-none truncate pr-9 pl-3")} {...props}>
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
    </div>
  );
}
