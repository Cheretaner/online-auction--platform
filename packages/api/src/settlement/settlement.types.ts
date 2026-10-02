export type SettlementStatus =
  | "due"
  | "payment_pending"
  | "paid"
  | "cancelled"
  | "reconciliation_required";

export interface SettlementObligation {
  id: string;
  auctionId: string;
  winnerId: string;
  amount: string;
  currency: "ETB";
  status: SettlementStatus;
  dueAt: string;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}