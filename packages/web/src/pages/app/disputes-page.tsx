import { useDisputes } from "@/features/operations/queries";
import { ResourcePage } from "@/components/feedback/resource-page";
export default function DisputesPage() {
  const query = useDisputes();
  return (
    <ResourcePage
      title="Disputes"
      description="Dispute cases visible to your authenticated account."
      query={query}
    />
  );
}
