import { useMyDocuments } from "@/features/operations/queries";
import { ResourcePage } from "@/components/feedback/resource-page";
export default function DocumentsPage() {
  const query = useMyDocuments();
  return (
    <ResourcePage
      title="Documents"
      description="Files you have uploaded, such as deposit instruments. Auction documents live on each auction's page."
      emptyDescription="Files you upload while registering a deposit appear here."
      query={query}
    />
  );
}
