import { randomUUID } from "node:crypto";
import * as repo from "./compliance.repository.js";
import type { ComplianceCheck } from "./compliance.types.js";

export async function runComplianceCheck(auctionId: string, notes?: string): Promise<ComplianceCheck> {
  const check: ComplianceCheck = {
    id: randomUUID(),
    auctionId,
    status: "passed",
    notes,
    checkedAt: new Date().toISOString(),
  };
  await repo.saveCheck(check);
  return check;
}

export async function listChecks(auctionId: string): Promise<ComplianceCheck[]> {
  return repo.findByAuction(auctionId);
}
