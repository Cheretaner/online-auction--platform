import { Assistant } from "@/features/ai/assistant";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { useT } from "@/i18n/context";

export default function AiAssistantPage() {
  const t = useT("tools");
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <PageHeader
        title={t("assistant.pageTitle")}
        description={t("assistant.pageDescription")}
      />
      <Alert>
        <Info aria-hidden />
        <AlertTitle>{t("assistant.guidanceTitle")}</AlertTitle>
        <AlertDescription>{t("assistant.guidanceBody")}</AlertDescription>
      </Alert>
      <Assistant />
    </div>
  );
}
