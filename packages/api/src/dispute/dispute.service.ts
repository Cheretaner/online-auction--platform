import { randomUUID } from "node:crypto";
import * as repo from "./dispute.repository.js";
import type { Dispute } from "./dispute.types.js";

export async function openDispute(input: {
  auctionId: string;
  raisedBy: string;
  reason: string;
}): Promise<Dispute> {
  const dispute: Dispute = {
    id: randomUUID(),
    auctionId: input.auctionId,
    raisedBy: input.raisedBy,
    reason: input.reason,
    status: "open",
    createdAt: new Date().toISOString(),
  };
  await repo.saveDispute(dispute);
  return dispute;
}

export async function listDisputes(): Promise<Dispute[]> {
  return repo.listDisputes();
}
