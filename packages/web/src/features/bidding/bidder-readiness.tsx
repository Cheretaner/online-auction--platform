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
  useUploadDocument,
} from "@/features/operations/queries";
import type { BidderReadiness } from "@/features/bidding/use-bidder-readiness";
import { getErrorMessage } from "@/lib/api/errors";
import type { Auction } from "@/lib/api/types";
import { applyApiFieldErrors } from "@/lib/forms/api-errors";
import { formatDateTime, formatMoney } from "@/lib/format";
import { useAuth } from "@/features/auth/auth-provider";

const INSTRUMENT_LABELS: Record<(typeof INSTRUMENT_TYPES)[number], string> = {
  cpo: "CPO (certified payment order)",
  bank_guarantee: "Bank guarantee",
  transfer: "Bank transfer",
};

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
      <Step state={kycState} title="Identity verified">
        {kycStatus === "verified" ? null : (
          <p className="text-sm text-muted-foreground">
            {kycStatus === "pending"
              ? "Your documents are with the compliance team. You can bid once they approve them."
              : kycStatus === "rejected"
                ? "Your verification was not accepted. Check the reason and submit again."
                : "Verify your identity once to bid on any auction."}{" "}
            <Link to="/app/kyc" className="font-medium text-primary underline-offset-4 hover:underline">
              {kycStatus === "pending" ? "View status" : "Verify identity"}
            </Link>
          </p>
        )}
      </Step>
      {depositRequired ? (
        <Step state={depositState} title={`Bid security of ${formatMoney(auction.depositAmount)}`}>
          {deposit ? (
            <p className="text-sm text-muted-foreground">
              {deposit.status === "pending" && deposit.instrumentType === "chapa" && "Chapa payment is pending confirmation."}
              {deposit.status === "pending" && deposit.instrumentType !== "chapa" && `Submitted (${deposit.referenceNumber}). The organization is checking it.`}
              {deposit.status === "verified" && `Verified (${deposit.referenceNumber}).`}
              {deposit.status === "released" && "Released back to you."}
              {deposit.status === "rejected" && `Rejected: ${deposit.rejectionReason ?? "no reason given"}.`}
            </p>
          ) : null}
          {deposit?.instrumentType === "chapa" && ["pending", "rejected"].includes(deposit.status) && acceptsDeposits ? (
            <ChapaCheckoutButton auction={auction} />
          ) : (!deposit || deposit.status === "rejected") && acceptsDeposits ? (
            deposit?.status === "rejected" ? (
              <p className="text-sm text-muted-foreground">
                Contact the organization to register a corrected instrument; only one deposit per auction is accepted.
              </p>
            ) : (
              <DepositForm auction={auction} />
            )
          ) : null}
          {!deposit && !acceptsDeposits ? (
            <p className="text-sm text-muted-foreground">This auction no longer accepts deposits.</p>
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
  const state = settlement?.status === "paid" ? "done" : settlement?.status === "reconciliation_required" ? "failed" : "waiting";
  return (
    <Step state={state} title="Final payment">
      {!settlement ? <p className="text-sm text-muted-foreground">Loading your payment obligation…</p> : null}
      {settlement?.status === "paid" ? <p className="text-sm text-muted-foreground">Payment of {formatMoney(settlement.amount)} ETB received.</p> : null}
      {settlement?.status === "reconciliation_required" ? <p className="text-sm text-destructive">Payment needs reconciliation. Contact the auction organization.</p> : null}
      {settlement && ["due", "payment_pending"].includes(settlement.status) ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {formatMoney(settlement.amount)} ETB due by {formatDateTime(settlement.dueAt)}. Bid security is handled separately.
          </p>
          {providers.data?.chapa ? (
            <Button
              size="sm"
              disabled={initiate.isPending}
              onClick={() => initiate.mutate(auction.id, {
                onSuccess: (result) => result.checkoutUrl
                  ? window.location.assign(result.checkoutUrl)
                  : toast.success("Final payment is already complete."),
                onError: (error) => toast.error(getErrorMessage(error)),
              })}
            >
              <CreditCard className="size-4" aria-hidden />
              {initiate.isPending ? "Opening checkout…" : "Pay final amount with Chapa"}
            </Button>
          ) : <p className="text-sm text-muted-foreground">Contact the auction organization to arrange final payment.</p>}
        </div>
      ) : null}
    </Step>
  );
}

function DepositForm({ auction }: { auction: Auction }) {
  const create = useCreateDeposit();
  const upload = useUploadDocument();
  const [proof, setProof] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
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
            toast.success("Deposit submitted for verification");
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
              <FormLabel>Amount (ETB)</FormLabel>
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
              <FormLabel>Instrument</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {INSTRUMENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {INSTRUMENT_LABELS[type]}
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
              <FormLabel>Issuing bank</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a bank" />
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
              <FormLabel>Reference number</FormLabel>
              <FormControl>
                <Input autoComplete="off" placeholder="Letters, numbers, /, . or -" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="space-y-1.5 @md:col-span-2">
          <Label htmlFor={`deposit-proof-${auction.id}`}>
            Scan or photo of the instrument
            <OptionalHint />
          </Label>
          <Input
            id={`deposit-proof-${auction.id}`}
            type="file"
            accept="image/*,application/pdf"
            onChange={(event) => setProof(event.target.files?.[0] ?? null)}
          />
          <FieldHint>Recommended. Only you and the organization's officers can see this file.</FieldHint>
        </div>
        <div className="@md:col-span-2">
          <Button type="submit" loading={submitting}>
            {submitting ? "Submitting…" : "Submit deposit"}
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
  if (!providers.data?.chapa) return null;
  return (
    <Button
      type="button"
      variant="outline"
      disabled={chapa.isPending || disabled}
      onClick={() => chapa.mutate({ auctionId: auction.id }, {
        onSuccess: (result) => {
          if (result.checkoutUrl) window.location.assign(result.checkoutUrl);
          else toast.success("Your deposit is already verified.");
        },
        onError: (error) => toast.error(getErrorMessage(error)),
      })}
    >
      <CreditCard className="size-4" aria-hidden />
      {chapa.isPending ? "Opening checkout…" : "Pay bid security with Chapa"}
    </Button>
  );
}
