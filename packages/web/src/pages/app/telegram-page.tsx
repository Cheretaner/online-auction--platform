import { useTelegramStatus } from "@/features/operations/queries";
import { ResourcePage } from "@/components/feedback/resource-page";
export default function TelegramPage() {
  const query = useTelegramStatus();
  return (
    <ResourcePage
      title="Telegram integration"
      description="Check whether your account is linked to the platform Telegram bot."
      query={query}
    />
  );
}
