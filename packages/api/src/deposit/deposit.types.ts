import type { DepositStatus, InstrumentType } from "@auction/shared";

export interface Deposit {
  id: string;
  auctionId: string;
  bidderId: string;
  amount: string;
  referenceNumber: string;
  issuingBank: string;
  instrumentType: InstrumentType;
  documentId: string | null;
  status: DepositStatus;
  verifiedBy: string | null;
  verifiedAt: string | null;
  releasedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}
