import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePlaceBid } from "@/features/auctions/queries";
import type { Auction } from "@/lib/api/types";
import { explainBidError, type BidErrorExplanation } from "@/lib/bid-errors";
import { formatMoney } from "@/lib/format";
import { createSealedCommitment, normalizeAmount } from "@/lib/sealed-bid";

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
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
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
          />
          <p className="text-xs text-muted-foreground">
            {sealed
              ? `Minimum ${formatMoney(minimum)}. Other bidders and staff cannot see your amount until bids are opened.`
              : `Minimum ${formatMoney(minimum)} (current highest plus the ${formatMoney(auction.minIncrement)} increment).`}
          </p>
        </div>
        <Button type="submit" disabled={disabled || placeBid.isPending || !amount.trim()}>
          {placeBid.isPending ? "Submitting…" : sealed ? "Submit sealed bid" : "Place bid"}
        </Button>
      </form>

      {problem ? (
        <Alert variant="destructive">
          <AlertTitle>Bid not placed</AlertTitle>
          <AlertDescription>
            {problem.message}{" "}
            {problem.action ? (
              <Link className="underline" to={problem.action.to}>
                {problem.action.label}
              </Link>
            ) : null}
          </AlertDescription>
        </Alert>
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
    <Alert>
      <AlertTitle>Keep this sealed-bid receipt</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>
          The commitment below is stored in the audit trail. After bids are opened, the amount, nonce and auction id
          recompute to this commitment, which proves your bid was not changed.
        </p>
        <pre className="overflow-x-auto rounded bg-muted p-2 text-xs">{text}</pre>
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
      </AlertDescription>
    </Alert>
  );
}
