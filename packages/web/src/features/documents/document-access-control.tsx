import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useDocumentAccessStatus, useInitiateDocumentAccess } from "@/features/operations/queries";
import { getErrorMessage } from "@/lib/api/errors";
import { formatMoney } from "@/lib/format";
import { useT } from "@/i18n/context";
import { useAuth } from "@/features/auth/auth-provider";

export function DocumentAccessControl({ auctionId, enabled = true }: { auctionId: string; enabled?: boolean }) {
  const { session } = useAuth();
  const access = useDocumentAccessStatus(auctionId, enabled, session?.user.id);
  const initiate = useInitiateDocumentAccess(auctionId);
  const t = useT("auctions");
  const tc = useT("common");
  const state = access.data;

  if (!enabled || access.isLoading) return null;
  if (access.isError) {
    return (
      <Alert variant="warning">
        <AlertTitle>{t("documents.accessStatusUnavailable")}</AlertTitle>
        <AlertDescription>
          <Button size="sm" variant="outline" className="mt-2" onClick={() => void access.refetch()}>
            {tc("tryAgain")}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
  if (!state?.required) return null;

  const pending = state.status === "pending";
  const needsReconciliation = state.status === "reconciliation_required";
  const checking = access.isFetching || initiate.isPending;
  const startOrContinue = async () => {
    if (pending) {
      if (state.checkoutUrl) {
        window.location.assign(state.checkoutUrl);
      } else {
        const result = await access.refetch();
        if (result.data?.paid) toast.success(t("documents.accessGranted"));
      }
      return;
    }
    try {
      const result = await initiate.mutateAsync();
      if (result.checkoutUrl) {
        window.location.assign(result.checkoutUrl);
      } else if (result.status === "succeeded") {
        await access.refetch();
        toast.success(t("documents.accessGranted"));
      } else {
        await access.refetch();
      }
    } catch (error) {
      toast.error(getErrorMessage(error, t("documents.paymentFailed")));
    }
  };
  const verifyPayment = async () => {
    const result = await access.refetch();
    if (result.data?.paid) toast.success(t("documents.accessGranted"));
  };

  return (
    <Alert variant={state.paid ? "default" : needsReconciliation ? "warning" : "default"}>
      <AlertTitle>{state.paid ? t("documents.accessGranted") : t("documents.accessRequired")}</AlertTitle>
      <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
        <span>
          {state.paid
            ? t("documents.accessReady")
            : needsReconciliation
              ? t("documents.accessReconciliation")
              : pending
                ? t("documents.paymentPending")
                : t("documents.accessFee", { amount: formatMoney(state.amount, "ETB") })}
        </span>
        {!state.paid && !needsReconciliation ? (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              loading={checking}
              disabled={checking}
              onClick={() => void startOrContinue()}
            >
              {pending
                ? state.checkoutUrl
                  ? t("documents.continuePayment")
                  : t("documents.verifyPayment")
                : t("documents.payAccess")}
            </Button>
            {pending && state.checkoutUrl ? (
              <Button
                size="sm"
                variant="outline"
                loading={access.isFetching}
                disabled={access.isFetching}
                onClick={() => void verifyPayment()}
              >
                {t("documents.verifyPayment")}
              </Button>
            ) : null}
          </div>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
