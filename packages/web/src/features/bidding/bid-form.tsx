import { useRef, useState } from "react";
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

  async function submit() {
    setProblem(null);
    const normalized = normalizeAmount(amount.trim());
    if (!/^\d+\.\d{2}$/.test(normalized)) {
      setProblem({ message: "Enter an amount in birr, for example 250000 or 250000.50." });
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
        body: { amount: current.amount, commitmentHash: current.commitmentHash },
        idempotencyKey: current.idempotencyKey,
      });
      if (sealed && current.commitmentHash && current.nonce) {
        setReceipt({ amount: current.amount, commitmentHash: current.commitmentHash, nonce: current.nonce });
      }
      toast.success(sealed ? "Sealed bid recorded" : "Bid placed");
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
      <form
        className="flex flex-col gap-3 @md:flex-row @md:items-start"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="flex-1 space-y-1.5">
          <Label htmlFor={`bid-amount-${auction.id}`}>Your bid (ETB)</Label>
          <Input
            id={`bid-amount-${auction.id}`}
            inputMode="decimal"
            placeholder={minimum}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            disabled={disabled}
            aria-invalid={problem ? true : undefined}
            aria-describedby={`bid-hint-${auction.id}`}
            className="h-11 text-base tabular-nums"
          />
          <FieldHint id={`bid-hint-${auction.id}`}>
            {sealed
              ? `Minimum ${formatMoney(minimum)}. Other bidders and staff cannot see your amount until bids are opened.`
              : `Minimum ${formatMoney(minimum)} (current highest plus the ${formatMoney(auction.minIncrement)} increment).`}
          </FieldHint>
        </div>
        <Button
          type="submit"
          size="lg"
          className="@md:mt-6"
          disabled={disabled || !amount.trim()}
          loading={placeBid.isPending}
        >
          {placeBid.isPending ? "Submitting…" : sealed ? "Submit sealed bid" : "Place bid"}
        </Button>
      </form>

      {problem ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertTitle>Bid not placed</AlertTitle>
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
          Restore saved receipt
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
                      throw new Error("This receipt does not match this auction or its commitment.");
                    }
                    setReceipt({
                      amount: normalizeAmount(parsed.amount),
                      nonce: parsed.nonce,
                      commitmentHash: parsed.commitmentHash,
                    });
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Could not read that receipt.");
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
  const text = [
    `Auction: ${auctionId}`,
    `Amount: ${receipt.amount}`,
    `Nonce: ${receipt.nonce}`,
    `Commitment: ${receipt.commitmentHash}`,
  ].join("\n");
  return (
    <Alert variant="success">
      <ReceiptText aria-hidden />
      <AlertTitle>Keep this sealed-bid receipt</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>
          The commitment below is stored in the audit trail. After bids are opened, the amount, nonce and auction id
          recompute to this commitment, which proves your bid was not changed.
        </p>
        <pre className="overflow-x-auto rounded-md border bg-card p-3 font-mono text-xs leading-5 text-foreground">{text}</pre>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            navigator.clipboard
              .writeText(text)
              .then(() => toast.success("Receipt copied"))
              .catch(() => toast.error("Copy failed. Select the text and copy it manually."));
          }}
        >
          <Copy className="size-4" aria-hidden /> Copy receipt
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
          <Download className="size-4" aria-hidden /> Download receipt
        </Button>
      </AlertDescription>
    </Alert>
  );
}
