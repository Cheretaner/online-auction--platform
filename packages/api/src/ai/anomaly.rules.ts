import type { AnomalySeverity, AnomalyStatus } from "@auction/shared";
import { jumpRatio, isRoundNumber } from "../bidding/bidding.rules.js";
import type { AuctionLockSnapshot, BidRecord } from "../bidding/bidding.types.js";

export interface AnomalyEvaluation {
  score: number;
  severity: AnomalySeverity;
  rules: string[];
  subjects: string[];
  features: Record<string, unknown>;
  explanation: string;
}

export function scoreAnomaly(input: Record<string, unknown>): number {
  let score = 0;
  if (typeof input.amount === "string" && Number(input.amount) > 1_000_000) score += 0.5;
  if (input.rapidBids === true) score += 0.3;
  return Math.min(1, score);
}

export function evaluateAuctionAnomalies(input: {
  auction: AuctionLockSnapshot;
  bids: BidRecord[];
  features: Array<{ ipHash: string | null; bidderId: string; amount: string; placedAt: Date }>;
  now?: Date;
}): AnomalyEvaluation | null {
  const bids = input.bids.filter((bid) => bid.status === "active");
  if (bids.length < 2) return null;

  const rules: string[] = [];
  const subjects = new Set<string>();
  let score = 0;
  const now = input.now ?? new Date();

  const byIp = new Map<string, Set<string>>();
  for (const feature of input.features) {
    if (!feature.ipHash) continue;
    const set = byIp.get(feature.ipHash) ?? new Set();
    set.add(feature.bidderId);
    byIp.set(feature.ipHash, set);
  }
  for (const [ip, accounts] of byIp) {
    if (accounts.size >= 2) {
      rules.push("shared_ip");
      score += 35;
      accounts.forEach((id) => subjects.add(id));
      void ip;
    }
  }

  const ordered = [...bids].sort((a, b) => a.placedAt.localeCompare(b.placedAt));
  for (let i = 1; i < ordered.length; i++) {
    const prev = ordered[i - 1];
    const next = ordered[i];
    const ratio = jumpRatio(prev.amount, next.amount);
    if (ratio >= 3) {
      rules.push("price_jump");
      score += 20;
      subjects.add(next.bidderId);
    }
    if (isRoundNumber(next.amount)) {
      rules.push("round_number");
      score += 5;
      subjects.add(next.bidderId);
    }
  }

  const windowMs = 60_000;
  const recent = input.features.filter((row) => now.getTime() - row.placedAt.getTime() <= windowMs);
  if (recent.length >= 4) {
    rules.push("rapid_fire");
    score += 25;
    recent.forEach((row) => subjects.add(row.bidderId));
  }

  const remaining = input.auction.closesAt.getTime() - now.getTime();
  if (remaining <= input.auction.antiSnipeSeconds * 1000 && remaining > 0) {
    const snipers = input.features.filter((row) => input.auction.closesAt.getTime() - row.placedAt.getTime() <= 15_000);
    if (snipers.length >= 2) {
      rules.push("snipe_cluster");
      score += 15;
      snipers.forEach((row) => subjects.add(row.bidderId));
    }
  }

  score = Math.min(100, score);
  if (score < 20 || subjects.size === 0) return null;

  const severity: AnomalySeverity = score >= 70 ? "high" : score >= 40 ? "medium" : "low";
  return {
    score,
    severity,
    rules: [...new Set(rules)],
    subjects: [...subjects],
    features: { bidCount: bids.length, remainingMs: remaining },
    explanation: `Triggered ${[...new Set(rules)].join(", ")} with score ${score}`,
  };
}

export function isOpenStatus(status: AnomalyStatus): boolean {
  return status === "open";
}
