export interface BidSummary {
  id: string;
  auctionId: string;
  bidderId: string;
  amount: string | null;
  status: string;
  isSealed: boolean;
  placedAt: string;
  redacted: boolean;
}
