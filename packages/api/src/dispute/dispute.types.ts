export type DisputeStatus = "open" | "under_review" | "resolved" | "rejected";

export interface Dispute {
  id: string;
  auctionId: string;
  raisedBy: string;
  reason: string;
  status: DisputeStatus;
  createdAt: string;
}
