import { useCategories } from "@/features/operations/queries";
import { ResourcePage } from "@/components/feedback/resource-page";
import { useT } from "@/i18n/context";
export default function CategoriesPage() {
  const query = useCategories();
  const t = useT("account");
  return (
    <ResourcePage
      title={t("lists.categoriesTitle")}
      description={t("lists.categoriesDescription")}
      query={query}
    />
  );
}
