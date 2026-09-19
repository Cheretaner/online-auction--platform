import type { AuctionStatus, AuctionType } from "@auction/shared";

export interface Auction {
  id: string;
  orgId: string;
  title: string;
  description: string | null;
  auctionType: AuctionType;
  status: AuctionStatus;
  startPrice: string;
  reservePrice: string | null;
  minIncrement: string;
  currentHighestBid: string | null;
  bidCount: number;
  depositAmount: string;
  eligibilityRules: string | null;
  region: string | null;
  opensAt: Date;
  closesAt: Date;
  originalClosesAt: Date;
  extensionCount: number;
  createdBy: string;
  approvedBy: string | null;
  winnerId: string | null;
  winningAmount: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
