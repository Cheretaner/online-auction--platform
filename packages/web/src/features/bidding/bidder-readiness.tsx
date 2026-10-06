import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateDepositRequest, ETHIOPIAN_BANKS, INSTRUMENT_TYPES } from "@auction/shared";
import { CheckCircle2, Circle, Clock, CreditCard, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldHint, Label, OptionalHint } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useCreateDeposit,
  useDepositPaymentProviders,
  useInitiateChapaDeposit,
  useInitiateChapaSettlement,
  useMySettlements,
  usePlatformCapabilities,
  useUploadDocument,
} from "@/features/operations/queries";
import type { BidderReadiness } from "@/features/bidding/use-bidder-readiness";
import { getErrorMessage } from "@/lib/api/errors";
import type { Auction } from "@/lib/api/types";
import { applyApiFieldErrors } from "@/lib/forms/api-errors";
import { enumLabel, formatDateTime, formatMoney } from "@/lib/format";
import { useAuth } from "@/features/auth/auth-provider";
import { useT } from "@/i18n/context";
import { Alert, AlertTitle } from "@/components/ui/alert";

function Step({ state, title, children }: { state: "done" | "waiting" | "todo" | "failed"; title: string; children?: React.ReactNode }) {
  const Icon = state === "done" ? CheckCircle2 : state === "waiting" ? Clock : state === "failed" ? XCircle : Circle;
  const tone =
    state === "done"
      ? "text-success"
      : state === "failed"
        ? "text-destructive"
        : state === "waiting"
          ? "text-warning"
          : "text-muted-foreground";
  return (
    <li className="flex gap-3">
      <Icon className={`mt-0.5 size-5 shrink-0 ${tone}`} aria-hidden />
      <div className="min-w-0 flex-1 space-y-2">
        <p className="leading-5 font-medium">{title}</p>
        {children}
      </div>
    </li>
  );
}

export function BidderReadinessPanel({ auction, readiness }: { auction: Auction; readiness: BidderReadiness }) {
  const t = useT("auctions");
  const { kycStatus, depositRequired, deposit } = readiness;
  const { session } = useAuth();
  const isWinner = auction.status === "awarded" && auction.winnerId === session?.user.id;
  const settlements = useMySettlements(isWinner);
  const settlement = settlements.data?.items.find((item) => item.auctionId === auction.id);
  const acceptsDeposits = auction.status === "scheduled" || auction.status === "live";

  const kycState = kycStatus === "verified" ? "done" : kycStatus === "pending" ? "waiting" : kycStatus === "rejected" ? "failed" : "todo";
  const depositState = !deposit
    ? "todo"
    : deposit.status === "verified" || deposit.status === "released"
      ? "done"
      : deposit.status === "pending"
        ? "waiting"
        : "failed";

  return (
    <ol className="space-y-4">
      <Step state={kycState} title={t("readiness.identity")}>
        {kycStatus === "verified" ? null : (
          <p className="text-sm text-muted-foreground">
            {kycStatus === "pending"
              ? t("readiness.kycPending")
              : kycStatus === "rejected"
                ? t("readiness.kycRejected")
                : t("readiness.kycTodo")}{" "}
            <Link to="/app/kyc" className="font-medium text-primary underline-offset-4 hover:underline">
              {kycStatus === "pending" ? t("readiness.viewStatus") : t("readiness.verify")}
            </Link>
          </p>
        )}
      </Step>
      {depositRequired ? (
        <Step state={depositState} title={t("readiness.bidSecurity", { amount: formatMoney(auction.depositAmount) })}>
          {deposit ? (
            <p className="text-sm text-muted-foreground">
              {deposit.status === "pending" && deposit.instrumentType === "chapa" && t("readiness.chapaPending")}
              {deposit.status === "pending" && deposit.instrumentType !== "chapa" && t("readiness.depositPending", { reference: deposit.referenceNumber })}
              {deposit.status === "verified" && t("readiness.depositVerified", { reference: deposit.referenceNumber })}
              {deposit.status === "released" && t("readiness.depositReleased")}
              {deposit.status === "rejected" &&
                t("readiness.depositRejected", { reason: deposit.rejectionReason ?? t("readiness.noReason") })}
            </p>
          ) : null}
          {deposit?.instrumentType === "chapa" && ["pending", "rejected"].includes(deposit.status) && acceptsDeposits ? (
            <ChapaCheckoutButton auction={auction} />
          ) : (!deposit || deposit.status === "rejected") && acceptsDeposits ? (
            deposit?.status === "rejected" ? (
              <p className="text-sm text-muted-foreground">
                {t("readiness.depositRejectedHelp")}
              </p>
            ) : (
              <DepositForm auction={auction} />
            )
          ) : null}
          {!deposit && !acceptsDeposits ? (
            <p className="text-sm text-muted-foreground">{t("readiness.noLongerAccepting")}</p>
          ) : null}
        </Step>
      ) : null}
      {isWinner ? <SettlementStep auction={auction} settlement={settlement} /> : null}
    </ol>
  );
}

function SettlementStep({ auction, settlement }: { auction: Auction; settlement: import("@/lib/api/types").SettlementRecord | undefined }) {
  const providers = useDepositPaymentProviders();
  const initiate = useInitiateChapaSettlement();
  const t = useT("auctions");
  const state = settlement?.status === "paid" ? "done" : settlement?.status === "reconciliation_required" ? "failed" : "waiting";
  return (
    <Step state={state} title={t("readiness.finalPayment")}>
      {!settlement ? <p className="text-sm text-muted-foreground">{t("readiness.loadingSettlement")}</p> : null}
      {settlement?.status === "paid" ? (
        <p className="text-sm text-muted-foreground">{t("readiness.paymentReceived", { amount: formatMoney(settlement.amount) })}</p>
      ) : null}
      {settlement?.status === "reconciliation_required" ? (
        <p className="text-sm text-destructive">{t("readiness.reconciliation")}</p>
      ) : null}
      {settlement && ["due", "payment_pending"].includes(settlement.status) ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {t("readiness.due", { amount: formatMoney(settlement.amount), date: formatDateTime(settlement.dueAt) })}
          </p>
          {providers.data?.chapa ? (
            <Button
              size="sm"
              disabled={initiate.isPending}
              onClick={() => initiate.mutate(auction.id, {
                onSuccess: (result) => result.checkoutUrl
                  ? window.location.assign(result.checkoutUrl)
                  : toast.success(t("readiness.finalComplete")),
                onError: (error) => toast.error(getErrorMessage(error)),
              })}
            >
              <CreditCard className="size-4" aria-hidden />
              {initiate.isPending ? t("readiness.openingCheckout") : t("readiness.payFinalChapa")}
            </Button>
          ) : <p className="text-sm text-muted-foreground">{t("readiness.contactForFinal")}</p>}
        </div>
      ) : null}
    </Step>
  );
}

function DepositForm({ auction }: { auction: Auction }) {
  const create = useCreateDeposit();
  const upload = useUploadDocument();
  const uploads = usePlatformCapabilities();
  const [proof, setProof] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const t = useT("auctions");
  const tc = useT("common");
  const form = useForm({
    resolver: zodResolver(CreateDepositRequest),
    defaultValues: {
      auctionId: auction.id,
      amount: auction.depositAmount,
      referenceNumber: "",
      issuingBank: ETHIOPIAN_BANKS[0],
      instrumentType: "cpo" as const,
    },
  });

  return (
    <div className="space-y-3">
      <ChapaCheckoutButton auction={auction} disabled={submitting} />
      <Form {...form}>
      <form
        className="grid gap-4 rounded-md border bg-background/60 p-4 @md:grid-cols-2"
        onSubmit={form.handleSubmit(async (values) => {
          setSubmitting(true);
          try {
            let documentId: string | undefined;
            const file = proof;
            if (file) {
              const data = new FormData();
              data.set("file", file);
              data.set("docType", "other");
              data.set("auctionId", auction.id);
              data.set("isPrivate", "true");
              documentId = (await upload.mutateAsync(data)).id;
            }
            await create.mutateAsync({ ...values, documentId });
            toast.success(t("readiness.submitted"));
          } catch (error) {
            if (!applyApiFieldErrors(error, form.setError)) toast.error(getErrorMessage(error));
          } finally {
            setSubmitting(false);
          }
        })}
      >
        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("readiness.amount", { currency: tc("currency") })}</FormLabel>
              <FormControl>
                <Input inputMode="decimal" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="instrumentType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("readiness.instrument")}</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {INSTRUMENT_TYPES.filter((type) => type !== "chapa").map((type) => (
                    <SelectItem key={type} value={type}>
                      {enumLabel(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="issuingBank"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("readiness.bank")}</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t("readiness.bankPlaceholder")} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {ETHIOPIAN_BANKS.map((bank) => (
                    <SelectItem key={bank} value={bank}>
                      {bank}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="referenceNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("readiness.reference")}</FormLabel>
              <FormControl>
                <Input autoComplete="off" placeholder={t("readiness.referencePlaceholder")} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="space-y-1.5 @md:col-span-2">
          <Label htmlFor={`deposit-proof-${auction.id}`}>
            {t("readiness.proof")}
            <OptionalHint />
          </Label>
          <Input
            id={`deposit-proof-${auction.id}`}
            type="file"
            accept="image/*,application/pdf"
            disabled={!uploads.isSuccess || !uploads.data.documentUploadsEnabled}
            onChange={(event) => setProof(event.target.files?.[0] ?? null)}
          />
          {uploads.isPending ? (
            <p className="text-xs text-muted-foreground" role="status">{tc("checkingDocumentUploads")}</p>
          ) : !uploads.isSuccess || !uploads.data.documentUploadsEnabled ? (
            <Alert variant="warning" className="mt-2">
              <AlertTitle>
                {uploads.isError ? tc("documentUploadsStatusUnknown") : tc("documentUploadsUnavailable")}
              </AlertTitle>
            </Alert>
          ) : <FieldHint>{t("readiness.proofHint")}</FieldHint>}
        </div>
        <div className="@md:col-span-2">
          <Button type="submit" loading={submitting}>
            {submitting ? t("readiness.submitting") : t("readiness.submit")}
          </Button>
        </div>
      </form>
      </Form>
    </div>
  );
}

function ChapaCheckoutButton({ auction, disabled = false }: { auction: Auction; disabled?: boolean }) {
  const chapa = useInitiateChapaDeposit();
  const providers = useDepositPaymentProviders();
  const t = useT("auctions");
  if (!providers.data?.chapa) return null;
  return (
    <Button
      type="button"
      variant="outline"
      disabled={chapa.isPending || disabled}
      onClick={() => chapa.mutate({ auctionId: auction.id }, {
        onSuccess: (result) => {
          if (result.checkoutUrl) window.location.assign(result.checkoutUrl);
          else toast.success(t("readiness.alreadyVerified"));
        },
        onError: (error) => toast.error(getErrorMessage(error)),
      })}
    >
      <CreditCard className="size-4" aria-hidden />
      {chapa.isPending ? t("readiness.openingCheckout") : t("readiness.payDepositChapa")}
    </Button>
  );
}
