const disputes = new Map<string, import("./dispute.types.js").Dispute>();

export async function saveDispute(dispute: import("./dispute.types.js").Dispute): Promise<void> {
  disputes.set(dispute.id, dispute);
}

export async function listDisputes(): Promise<import("./dispute.types.js").Dispute[]> {
  return [...disputes.values()];
}
