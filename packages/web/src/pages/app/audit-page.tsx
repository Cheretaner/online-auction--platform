import { useAuditEvents, useAuditVerify } from "@/features/operations/queries";
import { ResourcePage } from "@/components/feedback/resource-page";
import { LoaderCircle, ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export default function AuditPage() {
  const query = useAuditEvents();
  const verify = useAuditVerify();
  const result = verify.data as { valid?: boolean } | undefined;
  const status = verify.isLoading
    ? { label: "Checking…", tone: "muted" as const, Icon: LoaderCircle }
    : verify.isError
      ? { label: "Could not verify", tone: "warning" as const, Icon: ShieldAlert }
      : result?.valid === true
        ? { label: "Chain intact", tone: "success" as const, Icon: ShieldCheck }
        : result?.valid === false
          ? { label: "Integrity issue reported", tone: "destructive" as const, Icon: ShieldX }
          : { label: "Verification response received", tone: "muted" as const, Icon: ShieldAlert };

  return (
    <ResourcePage
      title="Audit ledger"
      description="Every recorded action, in order. Entries are hash-chained, so any edit to past records breaks the chain."
      query={query}
    >
      <Card className="mb-5">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
          <div>
            <p className="font-medium">Ledger integrity</p>
            <p className="text-sm text-muted-foreground">Checked across all recorded events.</p>
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
