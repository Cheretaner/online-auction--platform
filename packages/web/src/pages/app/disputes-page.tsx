import { Scale } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, QueryState } from "@/components/feedback/query-state";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/features/auth/auth-provider";
import { DisputeList } from "@/features/disputes/dispute-list";
import { useDisputes } from "@/features/operations/queries";
import { isOfficer } from "@/lib/format";
import { useT } from "@/i18n/context";
import { useState } from "react";

export default function DisputesPage() {
  const { roles } = useAuth();
  const disputes = useDisputes();
  const items = disputes.data?.items ?? [];
  const [statusFilter, setStatusFilter] = useState("all");
  const t = useT("account");
  const filteredItems = statusFilter === "all" ? items : items.filter((dispute) => dispute.status === statusFilter);
  return (
    <div>
      <PageHeader
        title={t("disputes.title")}
        description={
          isOfficer(roles)
            ? t("disputes.officerDescription")
            : t("disputes.bidderDescription")
        }
      />
      <QueryState
        isLoading={disputes.isLoading}
        isError={disputes.isError}
        error={disputes.error}
        isEmpty={items.length === 0}
        emptyIcon={Scale}
        emptyTitle={t("disputes.emptyTitle")}
        emptyDescription={isOfficer(roles) ? t("disputes.officerEmpty") : t("disputes.bidderEmpty")}
        onRetry={() => void disputes.refetch()}
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
              {t("disputes.count", { count: filteredItems.length })}
            </p>
            <div className="flex items-center gap-2">
              <label htmlFor="dispute-status-filter" className="text-sm font-medium">{t("disputes.filterStatus")}</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="dispute-status-filter" className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("disputes.allStatuses")}</SelectItem>
                  {(["open", "under_review", "resolved", "rejected"] as const).map((status) => (
                    <SelectItem key={status} value={status}>{t(`disputes.status.${status}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {filteredItems.length ? (
            <DisputeList items={filteredItems} />
          ) : (
            <EmptyState
              size="inline"
              icon={Scale}
              title={t("disputes.noStatusMatches")}
              description={t("disputes.clearFilterHint")}
              action={<Button variant="outline" onClick={() => setStatusFilter("all")}>{t("disputes.clearFilter")}</Button>}
            />
          )}
        </div>
      </QueryState>
    </div>
  );
}
