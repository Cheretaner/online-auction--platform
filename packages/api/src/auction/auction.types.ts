import type { AuctionStatus } from "@auction/shared";

export interface Auction {
  id: string;
  organizationId: string;
  title: string;
  description?: string;
  status: AuctionStatus;
  startingPrice: string;
  currentHighestBid?: string;
  bidCount: number;
  opensAt?: string;
  closesAt?: string;
  createdBy: string;
  createdAt: string;
}
