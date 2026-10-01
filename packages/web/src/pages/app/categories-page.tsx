import { useCategories } from "@/features/operations/queries";
import { ResourcePage } from "@/components/feedback/resource-page";
export default function CategoriesPage() {
  const query = useCategories();
  return (
    <ResourcePage
      title="Categories"
      description="The category list bidders use to filter auctions."
      query={query}
    />
  );
}
