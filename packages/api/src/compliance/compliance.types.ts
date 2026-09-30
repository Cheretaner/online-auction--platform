export interface ComplianceCheck {
  id: string;
  auctionId: string;
  status: "pending" | "passed" | "failed";
  notes?: string;
  checkedAt?: string;
}
