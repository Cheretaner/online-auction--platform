import { PageHeader } from "@/components/layout/page-header";
import { QueryState } from "@/components/feedback/query-state";
import { AnomalyList } from "@/features/anomalies/anomaly-list";
import { useAiAnomalies } from "@/features/operations/queries";

export default function AiPage() {
  const anomalies = useAiAnomalies();
  const items = anomalies.data?.items ?? [];
  const open = items.filter((flag) => flag.status === "open");
  const closed = items.filter((flag) => flag.status !== "open");
  return (
    <div className="space-y-6">
      <PageHeader
        title="Anomaly review"
        description="Rule-based flags on your organization's auctions. A person decides every flag; an open high-severity flag blocks the award."
      />
      <QueryState
        isLoading={anomalies.isLoading}
        isError={anomalies.isError}
        error={anomalies.error}
        isEmpty={items.length === 0}
        emptyTitle="No flags"
        emptyDescription="Flags appear here when bidding patterns trip the scoring rules."
        onRetry={() => void anomalies.refetch()}
      >
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Needs a decision ({open.length})</h2>
          {open.length === 0 ? <p className="text-sm text-muted-foreground">All flags have been reviewed.</p> : <AnomalyList items={open} />}
        </section>
        {closed.length > 0 ? (
          <section className="mt-8 space-y-3">
            <h2 className="text-lg font-semibold">Decided</h2>
            <AnomalyList items={closed} />
          </section>
        ) : null}
      </QueryState>
    </div>
  );
}
