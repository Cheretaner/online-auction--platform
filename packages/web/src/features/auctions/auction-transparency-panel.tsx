import { useState } from "react";
import { CheckCircle2, ExternalLink, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { API_PREFIX } from "@/config/constants";
import { apiRequest } from "@/lib/api/client";

interface VerificationResult {
  intact: boolean;
  eventCount: number;
  headHash: string | null;
  brokenAtSequence?: number;
  checkedAt: string;
}

export function AuctionTransparencyPanel({ auctionId, status }: { auctionId: string; status: string }) {
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const auctionUrl = `${window.location.origin}/auctions/${encodeURIComponent(auctionId)}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&format=svg&margin=8&data=${encodeURIComponent(auctionUrl)}`;
  const isFinal = status === "closed" || status === "awarded";

  async function verifyChain() {
    setIsChecking(true);
    setVerifyError(null);
    try {
      const result = await apiRequest<VerificationResult>(
        `${API_PREFIX}/audit/public/auctions/${encodeURIComponent(auctionId)}/verify`,
        { skipAuth: true },
      );
      setVerification(result);
    } catch {
      setVerifyError("Verification is temporarily unavailable. Please try again.");
    } finally {
      setIsChecking(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ShieldCheck className="size-5 text-primary" /> Public transparency</CardTitle>
        <p className="text-sm text-muted-foreground">Share this notice or independently check the published result.</p>
      </CardHeader>
      <CardContent className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="w-fit rounded-xl border bg-white p-2">
          <img src={qrUrl} alt="QR code linking to this public auction notice" width={160} height={160} className="size-40" loading="lazy" />
        </div>
        <div className="space-y-3">
          <div>
            <p className="font-medium">Scan to open the live notice</p>
            <a className="mt-1 block break-all text-xs text-primary hover:underline" href={auctionUrl}>{auctionUrl}</a>
            <a className="mt-2 inline-flex text-xs text-muted-foreground underline underline-offset-2" href={qrUrl} target="_blank" rel="noreferrer">
              Open or save the QR image
            </a>
          </div>
          {isFinal ? (
            <div className="space-y-2">
              <Button type="button" variant="outline" onClick={() => void verifyChain()} disabled={isChecking}>
                <ShieldCheck aria-hidden="true" /> {isChecking ? "Checking audit chain…" : "Verify public audit chain"}
              </Button>
              {verification ? (
                <div className="flex items-start gap-2 text-sm" aria-live="polite">
                  {verification.intact ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" /> : <ShieldAlert className="mt-0.5 size-4 shrink-0 text-destructive" />}
                  <p>
                    {verification.intact ? "Audit chain verified" : `Audit chain check failed${verification.brokenAtSequence ? ` at event ${verification.brokenAtSequence}` : ""}`}
                    <span className="block text-xs text-muted-foreground">{verification.eventCount} events · {verification.headHash ? `Head ${verification.headHash.slice(0, 16)}…` : "No recorded events"}</span>
                  </p>
                </div>
              ) : null}
              {verifyError ? <p role="alert" className="text-sm text-destructive">{verifyError}</p> : null}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
            <a className="inline-flex items-center gap-1 text-primary hover:underline" href={`${API_PREFIX}/open-data/auctions`} target="_blank" rel="noreferrer">
              Open data API <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
            <a className="inline-flex items-center gap-1 text-primary hover:underline" href={`${API_PREFIX}/open-data/weekly.csv`}>
              Download weekly CSV <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
