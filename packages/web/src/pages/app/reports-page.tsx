import { useReports } from "@/features/operations/queries";
import { ResourcePage } from "@/components/feedback/resource-page";
export default function ReportsPage() {
  const query = useReports();
  return (
    <ResourcePage
      title="Reports"
      description="Reports available to your role and organization context."
      query={query}
    />
  );
}
