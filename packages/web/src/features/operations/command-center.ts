import type { CommandCenterException } from "@/lib/api/types";

export function commandCenterLabel(source: CommandCenterException["source"]): string {
  return {
    verification: "KYC verification",
    deposit: "Deposit",
    dispute: "Dispute",
    anomaly: "Anomaly",
  }[source];
}
