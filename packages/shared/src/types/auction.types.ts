import type { AuctionStatus } from "../enums.js";

export interface AuctionSummary {
  id: string;
  title: string;
  status: AuctionStatus;
  startingPrice: string;
  currentHighestBid?: string;
  bidCount: number;
  closesAt?: string;
}
