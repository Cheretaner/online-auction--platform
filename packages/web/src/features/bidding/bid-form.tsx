import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CircleAlert, Copy, Download, ReceiptText, Upload } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldHint, Label } from "@/components/ui/label";
import { usePlaceBid } from "@/features/auctions/queries";
import type { Auction } from "@/lib/api/types";
import { explainBidError, type BidErrorExplanation } from "@/lib/bid-errors";
import { formatMoney } from "@/lib/format";
import { createSealedCommitment, normalizeAmount, verifySealedCommitment } from "@/lib/sealed-bid";
import { useT } from "@/i18n/context";
import { apiRequest, v1 } from "@/lib/api/client";
import { useAuth } from "@/features/auth/auth-provider";
import { useDocumentAccessStatus } from "@/features/operations/queries";
import { DocumentAccessControl } from "@/features/documents/document-access-control";

interface AuctionFormField {
  id: string;
  label: string;
  fieldType: "text" | "number" | "choice" | "range";
  options: string[];
  minValue: number | null;
  maxValue: number | null;
  required: boolean;
}

interface PendingAttempt {
  amount: string;
  idempotencyKey: string;
  commitmentHash?: string;
  nonce?: string;
}

interface SealedReceipt {
  amount: string;
  commitmentHash: string;
  nonce: string;
}

function minimumBid(auction: Auction): string {
  if (auction.auctionType === "sealed_bid") return auction.startPrice;
  const highest = Number(auction.currentHighestBid ?? 0);
  if (!highest) return auction.startPrice;
  return (highest + Number(auction.minIncrement)).toFixed(2);
}

/**
 * Bid entry. One Idempotency-Key (and, for sealed auctions, one commitment)
 * is created per intended bid and reused if the same bid is retried after a
 * failure, so a retry can never place a second bid. A new amount starts a
 * new attempt.
 */
export function BidForm({ auction, disabled }: { auction: Auction; disabled?: boolean }) {
  const placeBid = usePlaceBid(auction.id);
  const [amount, setAmount] = useState("");
  const [problem, setProblem] = useState<BidErrorExplanation | null>(null);
  const [receipt, setReceipt] = useState<SealedReceipt | null>(null);
  const attempt = useRef<PendingAttempt | null>(null);
  const sealed = auction.auctionType === "sealed_bid";
  const minimum = minimumBid(auction);
  const t = useT("auctions");
  const tc = useT("common");
  const { roles, session } = useAuth();
  const isBidder = roles.includes("bidder");
  const documentAccess = useDocumentAccessStatus(auction.id, !disabled && isBidder, session?.user.id);
  const accessBlocked = isBidder && (
    documentAccess.isLoading ||
    documentAccess.isError ||
    Boolean(documentAccess.data?.required && !documentAccess.data.paid)
  );
  const [formResponses, setFormResponses] = useState<Record<string, string>>({});
  const formFields = useQuery({
    queryKey: ["auction-form-fields", auction.id],
    queryFn: () => apiRequest<{ items: AuctionFormField[] }>(v1(`/auctions/${auction.id}/form-fields`)),
    enabled: !disabled && !accessBlocked,
  });

  async function submit() {
    if (accessBlocked) return;
    setProblem(null);
    const normalized = normalizeAmount(amount.trim());
    if (!/^\d+\.\d{2}$/.test(normalized)) {
      setProblem({ message: t("bid.invalidAmount") });
      return;
    }
    if (attempt.current?.amount !== normalized) {
      attempt.current = { amount: normalized, idempotencyKey: crypto.randomUUID() };
      if (sealed) {
        const commitment = await createSealedCommitment(auction.id, normalized);
        attempt.current.commitmentHash = commitment.commitmentHash;
        attempt.current.nonce = commitment.nonce;
      }
    }
    const current = attempt.current;
    try {
      await placeBid.mutateAsync({
        body: { amount: current.amount, commitmentHash: current.commitmentHash, formResponses },
        idempotencyKey: current.idempotencyKey,
      });
      if (sealed && current.commitmentHash && current.nonce) {
        setReceipt({ amount: current.amount, commitmentHash: current.commitmentHash, nonce: current.nonce });
      }
      toast.success(sealed ? t("bid.sealedRecorded") : t("bid.placed"));
      attempt.current = null;
      setAmount("");
    } catch (error) {
      const explained = explainBidError(error);
      setProblem(explained);
      // A definite rejection means this attempt is over; only keep the key
      // for network failures and timeouts, where the bid may have landed.
      const status = (error as { status?: number }).status;
      if (status !== 0 && status !== undefined && status < 500) attempt.current = null;
    }
  }

  return (
    <div className="space-y-4">
      {isBidder ? <DocumentAccessControl auctionId={auction.id} enabled={!disabled} /> : null}
      <form
        className="flex flex-col gap-3 @md:flex-row @md:items-start"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="flex-1 space-y-3">
          {formFields.data?.items.map((field) => (
            <div key={field.id} className="space-y-1.5">
              <Label htmlFor={`auction-field-${field.id}`}>{field.label}{field.required ? " *" : ""}</Label>
              {field.fieldType === "choice" ? (
                <select
                  id={`auction-field-${field.id}`}
                  className="h-11 w-full rounded-md border bg-background px-3"
                  value={formResponses[field.id] ?? ""}
                  onChange={(event) => setFormResponses((current) => ({ ...current, [field.id]: event.target.value }))}
                >
                  <option value="">Select an option</option>
                  {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              ) : (
                <Input
                  id={`auction-field-${field.id}`}
                  type={field.fieldType === "number" || field.fieldType === "range" ? "number" : "text"}
                  min={field.minValue ?? undefined}
                  max={field.maxValue ?? undefined}
                  value={formResponses[field.id] ?? ""}
                  onChange={(event) => setFormResponses((current) => ({ ...current, [field.id]: event.target.value }))}
                  disabled={disabled || accessBlocked}
                />
              )}
            </div>
          ))}
          <Label htmlFor={`bid-amount-${auction.id}`}>{t("bid.yourBid", { currency: tc("currency") })}</Label>
          <Input
            id={`bid-amount-${auction.id}`}
            inputMode="decimal"
            placeholder={minimum}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            disabled={disabled || accessBlocked}
            aria-invalid={problem ? true : undefined}
            aria-describedby={`bid-hint-${auction.id}`}
            className="h-11 text-base tabular-nums"
          />
          <FieldHint id={`bid-hint-${auction.id}`}>
            {sealed
              ? t("bid.sealedHint", { minimum: formatMoney(minimum) })
              : t("bid.openHint", { minimum: formatMoney(minimum), increment: formatMoney(auction.minIncrement) })}
          </FieldHint>
        </div>
        <Button
          type="submit"
          size="lg"
          className="@md:mt-6"
          disabled={disabled || accessBlocked || !amount.trim()}
          loading={placeBid.isPending}
        >
          {placeBid.isPending ? t("bid.submitting") : sealed ? t("bid.submitSealed") : t("bid.place")}
        </Button>
      </form>

      {problem ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertTitle>{t("bid.notPlaced")}</AlertTitle>
          <AlertDescription>
            {problem.message}{" "}
            {problem.action ? (
              <Link className="font-medium text-foreground underline underline-offset-4" to={problem.action.to}>
                {problem.action.label}
              </Link>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      {sealed && !receipt ? (
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-primary underline">
          <Upload className="size-4" aria-hidden />
          {t("bid.restoreReceipt")}
          <input
            className="sr-only"
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) {
                void file.text().then(async (contents) => {
                  try {
                    const parsed = JSON.parse(contents) as Record<string, unknown>;
                    if (
                      parsed.auctionId !== auction.id ||
                      typeof parsed.amount !== "string" ||
                      typeof parsed.nonce !== "string" ||
                      typeof parsed.commitmentHash !== "string" ||
                      !(await verifySealedCommitment(auction.id, parsed.amount, parsed.nonce, parsed.commitmentHash))
                    ) {
                      throw new Error(t("bid.receiptMismatch"));
                    }
                    setReceipt({
                      amount: normalizeAmount(parsed.amount),
                      nonce: parsed.nonce,
                      commitmentHash: parsed.commitmentHash,
                    });
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : t("bid.receiptUnreadable"));
                  }
                });
              }
            }}
          />
        </label>
      ) : null}
      {receipt ? <SealedReceiptCard auctionId={auction.id} receipt={receipt} /> : null}
    </div>
  );
}

function SealedReceiptCard({ auctionId, receipt }: { auctionId: string; receipt: SealedReceipt }) {
  const t = useT("auctions");
  const tc = useT("common");
  const text = [
    `${t("bid.receiptAuction")}: ${auctionId}`,
    `${t("bid.receiptAmount")}: ${receipt.amount}`,
    `${t("bid.receiptNonce")}: ${receipt.nonce}`,
    `${t("bid.receiptCommitment")}: ${receipt.commitmentHash}`,
  ].join("\n");
  return (
    <Alert variant="success">
      <ReceiptText aria-hidden />
      <AlertTitle>{t("bid.receiptTitle")}</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>{t("bid.receiptBody")}</p>
        <pre className="overflow-x-auto rounded-md border bg-card p-3 font-mono text-xs leading-5 text-foreground">{text}</pre>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            navigator.clipboard
              .writeText(text)
              .then(() => toast.success(t("bid.receiptCopied")))
              .catch(() => toast.error(tc("copyFailed")));
          }}
        >
          <Copy className="size-4" aria-hidden /> {t("bid.copyReceipt")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            const blob = new Blob([JSON.stringify({ auctionId, ...receipt }, null, 2)], {
              type: "application/json",
            });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = `sealed-bid-${auctionId}.json`;
            anchor.click();
            URL.revokeObjectURL(url);
          }}
        >
          <Download className="size-4" aria-hidden /> {t("bid.downloadReceipt")}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
