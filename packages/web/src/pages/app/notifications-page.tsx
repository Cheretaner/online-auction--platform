import {
  useMarkAllNotificationsRead,
  useNotifications,
} from "@/features/operations/queries";
import { ResourcePage } from "@/components/feedback/resource-page";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCheck } from "lucide-react";
export default function NotificationsPage() {
  const query = useNotifications();
  const markAll = useMarkAllNotificationsRead();
  return (
    <ResourcePage
      title="Notifications"
      description="Updates about your auctions, deposits, identity checks and disputes."
      emptyDescription="You will be notified here when something needs your attention."
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
              onSuccess: () => toast.success("Notifications marked as read"),
              onError: (error) => toast.error(error.message),
            })
          }
        >
          <CheckCheck aria-hidden /> Mark all as read
        </Button>
      </div>
    </ResourcePage>
  );
}
