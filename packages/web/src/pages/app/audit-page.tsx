import { useAuditEvents, useAuditVerify } from "@/features/operations/queries";
import { ResourcePage } from "@/components/feedback/resource-page";
import { Card, CardContent } from "@/components/ui/card";

export default function AuditPage() {
  const query = useAuditEvents();
  const verify = useAuditVerify();
  const result = verify.data as { valid?: boolean } | undefined;
  const status = verify.isLoading
    ? "Checking..."
    : verify.isError
      ? "Could not verify"
      : result?.valid === true
        ? "Verified"
        : result?.valid === false
          ? "Integrity issue reported"
          : "Verification response received";

  return (
    <ResourcePage
      title="Audit ledger"
      description="Append-only audit events and verification status from the API."
      query={query}
    >
      <Card className="mb-5">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <span className="text-sm">Global ledger integrity</span>
          <span className="text-sm font-medium" role="status">
            {status}
          </span>
        </CardContent>
      </Card>
    </ResourcePage>
  );
}
