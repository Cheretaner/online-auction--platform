import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Shared frame for sign-in, registration and password screens. */
export function AuthCard({
  eyebrow,
  title,
  description,
  footer,
  wide = false,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cn("mx-auto w-full py-2 sm:py-6", wide ? "max-w-xl" : "max-w-md")}>
      <Card className="shadow-md">
        <CardHeader className="gap-2 pb-2 sm:pb-2">
          {eyebrow ? <p className="eyebrow text-primary">{eyebrow}</p> : null}
          <h1 className="text-2xl leading-tight font-semibold">{title}</h1>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </CardHeader>
        <CardContent className="pt-4 sm:pt-4">{children}</CardContent>
      </Card>
      {footer ? <div className="mt-5 text-center text-sm text-muted-foreground">{footer}</div> : null}
    </div>
  );
}

export const authLinkClass = "font-medium text-primary underline-offset-4 hover:underline";
