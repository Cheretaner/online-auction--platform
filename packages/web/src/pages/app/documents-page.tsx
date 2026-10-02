import { useMyDocuments } from "@/features/operations/queries";
import { ResourcePage } from "@/components/feedback/resource-page";
import { useT } from "@/i18n/context";
export default function DocumentsPage() {
  const query = useMyDocuments();
  const t = useT("account");
  return (
    <ResourcePage
      title={t("lists.documentsTitle")}
      description={t("lists.documentsDescription")}
      emptyDescription={t("lists.documentsEmpty")}
      query={query}
    />
  );
}
