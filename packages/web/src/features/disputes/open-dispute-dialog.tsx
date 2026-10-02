import { useState } from "react";
import { toast } from "sonner";
import { ReasonDialog } from "@/components/feedback/reason-dialog";
import { Button } from "@/components/ui/button";
import { useCreateDispute } from "@/features/operations/queries";
import { getErrorMessage } from "@/lib/api/errors";
import { useT } from "@/i18n/context";

/** Lets a participant formally contest how an auction was run. */
export function OpenDisputeButton({ auctionId }: { auctionId: string }) {
  const [open, setOpen] = useState(false);
  const create = useCreateDispute();
  const t = useT("auctions");
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        {t("dispute.raise")}
      </Button>
      <ReasonDialog
        open={open}
        onOpenChange={setOpen}
        title={t("dispute.raise")}
        description={t("dispute.description")}
        label={t("dispute.label")}
        confirmLabel={t("dispute.submit")}
        minLength={12}
        pending={create.isPending}
        onConfirm={(reason) =>
          create.mutate(
            { auctionId, reason, evidence: {} },
            {
              onSuccess: () => {
                toast.success(t("dispute.submitted"));
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
