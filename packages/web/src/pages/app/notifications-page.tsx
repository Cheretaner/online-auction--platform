import {
  useMarkAllNotificationsRead,
  useNotifications,
} from "@/features/operations/queries";
import { ResourcePage } from "@/components/feedback/resource-page";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCheck } from "lucide-react";
import { useT } from "@/i18n/context";
export default function NotificationsPage() {
  const query = useNotifications();
  const markAll = useMarkAllNotificationsRead();
  const t = useT("account");
  return (
    <ResourcePage
      title={t("lists.notificationsTitle")}
      description={t("lists.notificationsDescription")}
      emptyDescription={t("lists.notificationsEmpty")}
      query={query}
    >
      <div className="mb-5 flex justify-end">
        <Button
          variant="outline"
          size="sm"
          loading={markAll.isPending}
          disabled={!query.data?.items.length}
          onClick={() =>
            markAll.mutate(undefined, {
              onSuccess: () => toast.success(t("lists.markedAll")),
              onError: (error) => toast.error(error.message),
            })
          }
        >
          <CheckCheck aria-hidden /> {t("lists.markAll")}
        </Button>
      </div>
    </ResourcePage>
  );
}
