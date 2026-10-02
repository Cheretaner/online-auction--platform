import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateDepositRequest, INSTRUMENT_TYPES } from "@auction/shared";
import { CheckCircle2, Circle, Clock, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldHint, Label, OptionalHint } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateDeposit, useUploadDocument } from "@/features/operations/queries";
import type { BidderReadiness } from "@/features/bidding/use-bidder-readiness";
import { getErrorMessage } from "@/lib/api/errors";
import type { Auction } from "@/lib/api/types";
import { applyApiFieldErrors } from "@/lib/forms/api-errors";
import { enumLabel, formatMoney } from "@/lib/format";
import { useT } from "@/i18n/context";

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
  const t = useT("auctions");
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
              {deposit.status === "pending" && t("readiness.depositPending", { reference: deposit.referenceNumber })}
              {deposit.status === "verified" && t("readiness.depositVerified", { reference: deposit.referenceNumber })}
              {deposit.status === "released" && t("readiness.depositReleased")}
              {deposit.status === "rejected" &&
                t("readiness.depositRejected", { reason: deposit.rejectionReason ?? t("readiness.noReason") })}
            </p>
          ) : null}
          {(!deposit || deposit.status === "rejected") && acceptsDeposits ? (
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
    </ol>
  );
}

function DepositForm({ auction }: { auction: Auction }) {
  const create = useCreateDeposit();
  const upload = useUploadDocument();
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
      issuingBank: "",
      instrumentType: "cpo" as const,
    },
  });

  return (
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
                  {INSTRUMENT_TYPES.map((type) => (
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
              <FormControl>
                <Input placeholder={t("readiness.bankPlaceholder")} {...field} />
              </FormControl>
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
                <Input placeholder={t("readiness.referencePlaceholder")} {...field} />
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
            onChange={(event) => setProof(event.target.files?.[0] ?? null)}
          />
          <FieldHint>{t("readiness.proofHint")}</FieldHint>
        </div>
        <div className="@md:col-span-2">
          <Button type="submit" loading={submitting}>
            {submitting ? t("readiness.submitting") : t("readiness.submit")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
