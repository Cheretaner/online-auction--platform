import { Scale } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { QueryState } from "@/components/feedback/query-state";
import { useAuth } from "@/features/auth/auth-provider";
import { DisputeList } from "@/features/disputes/dispute-list";
import { useDisputes } from "@/features/operations/queries";
import { isOfficer } from "@/lib/format";
import { useT } from "@/i18n/context";

export default function DisputesPage() {
  const { roles } = useAuth();
  const disputes = useDisputes();
  const items = disputes.data?.items ?? [];
  const t = useT("account");
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
        <DisputeList items={items} />
      </QueryState>
    </div>
  );
}
