import type { AuctionType } from "@auction/shared";

export interface AuctionLockSnapshot {
  id: string;
  orgId: string;
  title: string;
  auctionType: AuctionType;
  status: string;
  startPrice: string;
  reservePrice: string | null;
  minIncrement: string;
  depositAmount: string;
  currentHighestBid: string;
  bidCount: number;
  opensAt: Date;
  closesAt: Date;
  originalClosesAt: Date;
  extensionCount: number;
  antiSnipeSeconds: number;
  maxExtensions: number;
  createdBy: string;
  approvedBy: string | null;
  winnerId: string | null;
  sealedOpenedAt: Date | null;
}

export interface BidderSnapshot {
  id: string;
  verificationStatus: string;
  email: string;
  displayName: string;
  isActive: boolean;
}

export interface BidRecord {
  id: string;
  auctionId: string;
  bidderId: string;
  amount: string;
  status: "active" | "withdrawn" | "superseded";
  isSealed: boolean;
  commitmentHash: string | null;
  placedAt: string;
  idempotencyKey: string;
  withdrawnAt?: string;
  withdrawalReason?: string;
}

export interface PlaceBidResult {
  bid: BidRecord;
  auction: {
    currentHighestBid: string;
    bidCount: number;
    closesAt: string;
    extended: boolean;
  };
  audit: {
    eventId: string;
    sequenceNo: number;
    hash: string;
  };
}
