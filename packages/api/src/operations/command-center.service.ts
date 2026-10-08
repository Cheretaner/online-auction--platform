export type ExceptionSource = "verification" | "deposit" | "dispute" | "anomaly";
export type ExceptionStatus = "open" | "pending" | "under_review" | "reviewed" | "rejected" | "released" | "verified" | "unverified";
export type ExceptionSeverity = "low" | "medium" | "high";

export interface CommandCenterException {
  id: string;
  source: ExceptionSource;
  title: string;
  status: ExceptionStatus;
  severity: ExceptionSeverity;
  createdAt: string;
  updatedAt: string;
  auctionId: string | null;
  actionPath: string;
}

const severityRank: Record<ExceptionSeverity, number> = { high: 3, medium: 2, low: 1 };
const terminalStatuses = new Set(["resolved", "rejected", "reviewed", "released", "verified", "unverified"]);

export function commandCenterActionPath(item: CommandCenterException): string {
  if (item.source === "verification") {
    return `/app/kyc/review?recordId=${encodeURIComponent(item.id)}`;
  }
  if (item.source === "deposit" && item.auctionId) {
    return `/app/auctions/${encodeURIComponent(item.auctionId)}?recordId=${encodeURIComponent(item.id)}&source=deposit`;
  }
  if (item.source === "dispute") {
    return `/app/disputes?recordId=${encodeURIComponent(item.id)}&source=dispute`;
  }
  if (item.source === "anomaly" && item.auctionId) {
    return `/app/ai?flagId=${encodeURIComponent(item.id)}`;
  }
  return item.actionPath;
}

export function prioritizeExceptions(items: CommandCenterException[]): CommandCenterException[] {
  return [...items]
    .filter((item) => !terminalStatuses.has(item.status))
    .sort((left, right) => {
      const severityDifference = severityRank[right.severity] - severityRank[left.severity];
      if (severityDifference !== 0) return severityDifference;
      const ageDifference = new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      if (ageDifference !== 0) return ageDifference;
      return left.title.localeCompare(right.title);
    });
}

export function exceptionStatusLabel(status: ExceptionStatus): string {
  return status.replaceAll("_", " ");
}
