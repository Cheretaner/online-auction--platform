import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { fieldBase } from "./field-styles";

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(fieldBase, "flex min-h-24 px-3 py-2 leading-6", className)} {...props} />;
}
