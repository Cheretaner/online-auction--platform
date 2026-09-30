import { Assistant } from "@/features/ai/assistant";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info } from "lucide-react";

export default function AiAssistantPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="AI assistant"
        description="Ask for help understanding auctions, preparing listings, or navigating the platform."
      />
      <Alert>
        <Info className="size-4" aria-hidden />
        <AlertTitle>Guidance for your review</AlertTitle>
        <AlertDescription>
          AI responses can be inaccurate and are for guidance only. They do not place bids, change auction
          records, or make compliance decisions. Avoid entering passwords, payment details, or private
          participant information.
        </AlertDescription>
      </Alert>
      <Assistant />
    </div>
  );
}
