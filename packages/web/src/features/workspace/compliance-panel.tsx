import { useId, useState } from "react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useComplianceChecks, useRunCompliance } from "@/features/operations/queries";
import { getErrorMessage } from "@/lib/api/errors";
import type { ComplianceCheckRecord } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";

function findingText(finding: ComplianceCheckRecord["findings"][number]): string {
  if (typeof finding === "string") return finding;
  return finding.message ?? finding.code ?? JSON.stringify(finding);
}

export function CompliancePanel({ auctionId, canRun }: { auctionId: string; canRun: boolean }) {
  const checks = useComplianceChecks(auctionId);
  const run = useRunCompliance();
  const [notes, setNotes] = useState("");
  const id = useId();
  const items = checks.data?.items ?? [];

  return (
    <div className="space-y-4">
      {canRun ? (
        <form
          className="space-y-2 rounded-md border p-3"
          onSubmit={(event) => {
            event.preventDefault();
            run.mutate(
              { auctionId, notes: notes.trim() || undefined },
              {
                onSuccess: () => {
                  toast.success("Compliance check recorded");
                  setNotes("");
                },
                onError: (error) => toast.error(getErrorMessage(error)),
              },
            );
          }}
        >
          <Label htmlFor={id}>Notes for this check (optional)</Label>
          <Textarea id={id} rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
          <Button type="submit" disabled={run.isPending}>
            {run.isPending ? "Running…" : "Run compliance check"}
          </Button>
        </form>
      ) : null}
      {checks.isLoading ? <p className="text-sm text-muted-foreground">Loading checks…</p> : null}
      {!checks.isLoading && items.length === 0 ? <p className="text-sm text-muted-foreground">No checks run yet.</p> : null}
      <ul className="space-y-3">
        {items.map((check) => (
          <li key={check.id} className="rounded-md border p-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{formatDateTime(check.createdAt)}</span>
              <StatusBadge status={check.status} />
            </div>
            {check.findings.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {check.findings.map((finding, index) => (
                  <li key={index}>{findingText(finding)}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2">No findings.</p>
            )}
            {check.notes ? <p className="mt-2 text-muted-foreground">{check.notes}</p> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
