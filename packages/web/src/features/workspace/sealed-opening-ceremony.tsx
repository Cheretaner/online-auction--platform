import { useState } from "react";
import { CheckCircle2, LockKeyhole, ShieldCheck } from "lucide-react";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuctionBids, useAuctionAction } from "@/features/auctions/queries";
import { useAuth } from "@/features/auth/auth-provider";
import type { Auction } from "@/lib/api/types";
import { formatDateTime, formatMoney, hasRole } from "@/lib/format";
import { useT } from "@/i18n/context";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/api/errors";

export function SealedOpeningCeremony({ auction }: { auction: Auction }) {
  const { roles } = useAuth();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const action = useAuctionAction(auction.id);
  const isOpened = Boolean(auction.sealedOpenedAt);
  const bids = useAuctionBids(auction.id, isOpened);
  const canOpen = hasRole(roles, "auction_officer", "org_admin", "compliance_officer", "super_admin");
  const t = useT("workspace");
  const activeBids = (bids.data?.items ?? []).filter((bid) => bid.status === "active");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isOpened ? <CheckCircle2 className="size-5 text-primary" aria-hidden /> : <LockKeyhole className="size-5 text-primary" aria-hidden />}
          {t("detail.ceremonyTitle")}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {isOpened ? t("detail.ceremonyComplete") : t("detail.ceremonyPending")}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 text-sm sm:grid-cols-3">
          <div><p className="eyebrow text-muted-foreground">{t("detail.ceremonyCloseTime")}</p><p className="mt-1 font-medium">{formatDateTime(auction.closedAt ?? auction.closesAt)}</p></div>
          <div><p className="eyebrow text-muted-foreground">{t("detail.ceremonyBidCount")}</p><p className="mt-1 font-medium">{isOpened ? activeBids.length : auction.bidCount}</p></div>
          <div><p className="eyebrow text-muted-foreground">{t("detail.ceremonyOpenedAt")}</p><p className="mt-1 font-medium">{formatDateTime(auction.sealedOpenedAt)}</p></div>
        </div>
        {!isOpened && canOpen && (auction.status === "closed" || auction.status === "under_review") ? (
          <Button variant="outline" loading={action.openSealed.isPending} onClick={() => setConfirmOpen(true)}>
            <ShieldCheck aria-hidden /> {t("detail.openSealed")}
          </Button>
        ) : null}
        {isOpened ? (
          <div className="space-y-2">
            <h3 className="font-semibold">{t("detail.ceremonyLedger")}</h3>
            {bids.isLoading ? <p className="text-sm text-muted-foreground">{t("detail.ceremonyLoading")}</p> : null}
            {bids.isError ? <p role="alert" className="text-sm text-destructive">{t("detail.ceremonyLedgerError")}</p> : null}
            {bids.isSuccess && activeBids.length === 0 ? <p className="text-sm text-muted-foreground">{t("detail.ceremonyNoBids")}</p> : null}
            {activeBids.length > 0 ? (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted text-muted-foreground"><tr><th className="p-2 font-medium">{t("detail.ceremonyBidder")}</th><th className="p-2 font-medium">{t("detail.ceremonyAmount")}</th><th className="p-2 font-medium">{t("detail.ceremonySubmitted")}</th></tr></thead>
                  <tbody>{activeBids.map((bid) => <tr key={bid.id} className="border-t"><td className="p-2 font-mono">{bid.bidderId}</td><td className="p-2 tabular-nums">{formatMoney(bid.amount)}</td><td className="p-2">{formatDateTime(bid.placedAt)}</td></tr>)}</tbody>
                </table>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("detail.ceremonyConfirmTitle")}
        description={t("detail.ceremonyConfirmDescription")}
        confirmLabel={t("detail.openSealed")}
        destructive
        pending={action.openSealed.isPending}
        onConfirm={() => action.openSealed.mutate(undefined, {
          onSuccess: () => { toast.success(t("detail.sealedOpened")); setConfirmOpen(false); },
          onError: (error) => toast.error(getErrorMessage(error)),
        })}
      />
    </Card>
  );
}
