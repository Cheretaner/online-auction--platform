import { useReports } from "@/features/operations/queries";
import { ResourcePage } from "@/components/feedback/resource-page";
export default function ReportsPage() {
  const query = useReports();
  return (
    <ResourcePage
      title="Reports"
      description="Auction reports generated for your organization. Generate new ones from an auction's Reports tab."
      emptyDescription="Reports appear here once one is generated from an auction."
      query={query}
    />
  );
}
