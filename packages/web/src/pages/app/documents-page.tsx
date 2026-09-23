import { useMyDocuments } from "@/features/operations/queries";
import { ResourcePage } from "@/components/feedback/resource-page";
export default function DocumentsPage() {
  const query = useMyDocuments();
  return (
    <ResourcePage
      title="Documents"
      description="Documents uploaded to your account and their API metadata."
      query={query}
    />
  );
}
