export type DepositStatus = "pending" | "held" | "released" | "forfeited";

export interface Deposit {
  id: string;
  userId: string;
  auctionId: string;
  amount: string;
  status: DepositStatus;
  createdAt: string;
}
