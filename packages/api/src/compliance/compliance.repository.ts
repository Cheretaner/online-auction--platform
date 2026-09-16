const checks = new Map<string, import("./compliance.types.js").ComplianceCheck>();

export async function saveCheck(check: import("./compliance.types.js").ComplianceCheck): Promise<void> {
  checks.set(check.id, check);
}

export async function findByAuction(auctionId: string) {
  return [...checks.values()].filter((check) => check.auctionId === auctionId);
}
