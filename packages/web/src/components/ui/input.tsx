import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { fieldBase } from "./field-styles";

export function Input({ className, type, ...props }: ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        fieldBase,
        "flex h-10 px-3 py-2 file:mr-3 file:h-7 file:cursor-pointer file:rounded-sm file:border-0 file:bg-secondary file:px-2.5 file:text-xs file:font-medium file:text-secondary-foreground",
        type === "file" && "h-auto py-1.5",
        className,
      )}
      {...props}
    />
  );
}
