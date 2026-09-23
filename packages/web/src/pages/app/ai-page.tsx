import { useAiAnomalies } from "@/features/operations/queries";
import { ResourcePage } from "@/components/feedback/resource-page";

export default function AiPage() {
  const query = useAiAnomalies();
  return (
    <ResourcePage
      title="AI review"
      description="Anomaly findings returned by the platform for accessible auctions."
      query={query}
    />
  );
}
