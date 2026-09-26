import { PageHeader } from "@/components/layout/page-header";
import { QueryState } from "@/components/feedback/query-state";
import { useAuth } from "@/features/auth/auth-provider";
import { DisputeList } from "@/features/disputes/dispute-list";
import { useDisputes } from "@/features/operations/queries";
import { isOfficer } from "@/lib/format";

export default function DisputesPage() {
  const { roles } = useAuth();
  const disputes = useDisputes();
  const items = disputes.data?.items ?? [];
  return (
    <div>
      <PageHeader
        title="Disputes"
        description={
          isOfficer(roles)
            ? "Disputes raised on your organization's auctions. Take one to review it, then record a decision."
            : "Disputes you raised and the decisions on them. Raise a new one from the auction page."
        }
      />
      <QueryState
        isLoading={disputes.isLoading}
        isError={disputes.isError}
        error={disputes.error}
        isEmpty={items.length === 0}
        emptyTitle="No disputes"
        onRetry={() => void disputes.refetch()}
      >
        <DisputeList items={items} />
      </QueryState>
    </div>
  );
}
