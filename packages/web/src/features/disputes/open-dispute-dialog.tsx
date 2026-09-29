import { useState } from "react";
import { toast } from "sonner";
import { ReasonDialog } from "@/components/feedback/reason-dialog";
import { Button } from "@/components/ui/button";
import { useCreateDispute } from "@/features/operations/queries";
import { getErrorMessage } from "@/lib/api/errors";

/** Lets a participant formally contest how an auction was run. */
export function OpenDisputeButton({ auctionId }: { auctionId: string }) {
  const [open, setOpen] = useState(false);
  const create = useCreateDispute();
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Raise a dispute
      </Button>
      <ReasonDialog
        open={open}
        onOpenChange={setOpen}
        title="Raise a dispute"
        description="Explain what went wrong. The organization's reviewers will respond, and every step is recorded in the audit trail."
        label="What happened"
        confirmLabel="Submit dispute"
        minLength={12}
        pending={create.isPending}
        onConfirm={(reason) =>
          create.mutate(
            { auctionId, reason, evidence: {} },
            {
              onSuccess: () => {
                toast.success("Dispute submitted. Track it under Disputes.");
                setOpen(false);
              },
              onError: (error) => toast.error(getErrorMessage(error)),
            },
          )
        }
      />
    </>
  );
}
