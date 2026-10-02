import { useAuditEvents, useAuditVerify } from "@/features/operations/queries";
import { ResourcePage } from "@/components/feedback/resource-page";
import { LoaderCircle, ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useT } from "@/i18n/context";

export default function AuditPage() {
  const query = useAuditEvents();
  const verify = useAuditVerify();
  const result = verify.data as { valid?: boolean } | undefined;
  const t = useT("account");
  const status = verify.isLoading
    ? { label: t("audit.checking"), tone: "muted" as const, Icon: LoaderCircle }
    : verify.isError
      ? { label: t("audit.couldNotVerify"), tone: "warning" as const, Icon: ShieldAlert }
      : result?.valid === true
        ? { label: t("audit.intact"), tone: "success" as const, Icon: ShieldCheck }
        : result?.valid === false
          ? { label: t("audit.issue"), tone: "destructive" as const, Icon: ShieldX }
          : { label: t("audit.received"), tone: "muted" as const, Icon: ShieldAlert };

  return (
    <ResourcePage
      title={t("audit.title")}
      description={t("audit.description")}
      query={query}
    >
      <Card className="mb-5">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
          <div>
            <p className="font-medium">{t("audit.integrity")}</p>
            <p className="text-sm text-muted-foreground">{t("audit.integrityHint")}</p>
          </div>
          <Badge variant={status.tone} role="status" className="text-sm">
            <status.Icon className={verify.isLoading ? "animate-spin" : undefined} aria-hidden />
            {status.label}
          </Badge>
        </CardContent>
      </Card>
    </ResourcePage>
  );
}
