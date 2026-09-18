import type { AuctionStatus, AuctionType } from "@auction/shared";

export interface Auction {
  id: string;
  orgId: string;
  title: string;
  description?: string;
  auctionType: AuctionType;
  status: AuctionStatus;
  startPrice: string;
  reservePrice: string | null;
  minIncrement: string;
  depositAmount: string;
  currentHighestBid: string;
  bidCount: number;
  opensAt: string;
  closesAt: string;
  originalClosesAt: string;
  extensionCount: number;
  antiSnipeSeconds: number;
  maxExtensions: number;
  createdBy: string;
  approvedBy?: string;
  winnerId?: string;
  winningAmount?: string;
  sealedOpenedAt?: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}
