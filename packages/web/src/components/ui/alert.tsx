import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative grid w-full grid-cols-[0_1fr] items-start gap-y-1 rounded-lg border px-4 py-3 text-sm has-[>svg]:grid-cols-[1rem_1fr] has-[>svg]:gap-x-3 [&>svg]:mt-0.5 [&>svg]:size-4",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground [&>svg]:text-muted-foreground",
        info: "border-info/30 bg-info/5 [&>svg]:text-info",
        success: "border-success/30 bg-success/5 [&>svg]:text-success",
        warning: "border-warning/35 bg-warning/5 [&>svg]:text-warning",
        destructive: "border-destructive/35 bg-destructive/5 [&>svg]:text-destructive",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Alert({
  className,
  variant,
  ...props
}: HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>) {
  // Only problems interrupt screen readers; informational notes stay polite.
  const role = variant === "destructive" ? "alert" : "status";
  return <div role={role} className={cn(alertVariants({ variant }), className)} {...props} />;
}

export function AlertTitle({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("col-start-2 leading-5 font-semibold text-foreground", className)} {...props} />;
}

export function AlertDescription({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("col-start-2 text-sm leading-6 text-muted-foreground", className)} {...props} />;
}
