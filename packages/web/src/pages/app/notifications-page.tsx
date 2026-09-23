import {
  useMarkAllNotificationsRead,
  useNotifications,
} from "@/features/operations/queries";
import { ResourcePage } from "@/components/feedback/resource-page";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
export default function NotificationsPage() {
  const query = useNotifications();
  const markAll = useMarkAllNotificationsRead();
  return (
    <ResourcePage
      title="Notifications"
      description="Messages and updates delivered by the auction API."
      query={query}
    >
      <div className="mb-5">
        <Button
          variant="outline"
          disabled={markAll.isPending || !query.data?.items.length}
          onClick={() =>
            markAll.mutate(undefined, {
              onSuccess: () => toast.success("Notifications marked as read"),
              onError: (error) => toast.error(error.message),
            })
          }
        >
          Mark all as read
        </Button>
      </div>
    </ResourcePage>
  );
}
