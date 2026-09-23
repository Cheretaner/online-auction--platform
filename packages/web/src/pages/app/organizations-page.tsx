import { useOrganizations } from "@/features/operations/queries";
import { ResourcePage } from "@/components/feedback/resource-page";
export default function OrganizationsPage() {
  const query = useOrganizations();
  return (
    <ResourcePage
      title="Organizations"
      description="Organizations visible to the platform administrator."
      query={query}
    />
  );
}
