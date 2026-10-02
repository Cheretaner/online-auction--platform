import { useReports } from "@/features/operations/queries";
import { ResourcePage } from "@/components/feedback/resource-page";
import { useT } from "@/i18n/context";
export default function ReportsPage() {
  const query = useReports();
  const t = useT("account");
  return (
    <ResourcePage
      title={t("lists.reportsTitle")}
      description={t("lists.reportsDescription")}
      emptyDescription={t("lists.reportsEmpty")}
      query={query}
    />
  );
}
