import { useState } from "react";
import { CheckCircle2, ExternalLink, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { API_PREFIX } from "@/config/constants";
import { apiRequest } from "@/lib/api/client";
import { useT } from "@/i18n/context";

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
  const t = useT("auctions");
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
      setVerifyError(t("detail.verificationUnavailable"));
    } finally {
      setIsChecking(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ShieldCheck className="size-5 text-primary" /> {t("detail.transparencyTitle")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("detail.transparencyDescription")}</p>
      </CardHeader>
      <CardContent className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="w-fit rounded-xl border bg-white p-2">
          <img src={qrUrl} alt={t("detail.qrAlt")} width={160} height={160} className="size-40" loading="lazy" />
        </div>
        <div className="space-y-3">
          <div>
            <p className="font-medium">{t("detail.scanNotice")}</p>
            <a className="mt-1 block break-all text-xs text-primary hover:underline" href={auctionUrl}>{auctionUrl}</a>
            <a className="mt-2 inline-flex text-xs text-muted-foreground underline underline-offset-2" href={qrUrl} target="_blank" rel="noreferrer">
              {t("detail.saveQr")}
            </a>
          </div>
          {isFinal ? (
            <div className="space-y-2">
              <Button type="button" variant="outline" onClick={() => void verifyChain()} disabled={isChecking}>
                <ShieldCheck aria-hidden="true" /> {isChecking ? t("detail.checkingAudit") : t("detail.verifyAudit")}
              </Button>
              {verification ? (
                <div className="flex items-start gap-2 text-sm" aria-live="polite">
                  {verification.intact ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" /> : <ShieldAlert className="mt-0.5 size-4 shrink-0 text-destructive" />}
                  <p>
                    {verification.intact
                      ? t("detail.auditVerified")
                      : t("detail.auditFailed", { event: verification.brokenAtSequence ? t("detail.auditEvent", { sequence: verification.brokenAtSequence }) : "" })}
                    <span className="block text-xs text-muted-foreground">
                      {t("detail.eventCount", { count: verification.eventCount })} · {verification.headHash
                        ? t("detail.headHash", { hash: verification.headHash.slice(0, 16) })
                        : t("detail.noRecordedEvents")}
                    </span>
                  </p>
                </div>
              ) : null}
              {verifyError ? <p role="alert" className="text-sm text-destructive">{verifyError}</p> : null}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
            <a className="inline-flex items-center gap-1 text-primary hover:underline" href={`${API_PREFIX}/open-data/auctions`} target="_blank" rel="noreferrer">
              {t("detail.openData")} <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
