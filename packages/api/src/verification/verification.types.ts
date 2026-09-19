import type { VerificationStatus } from "@auction/shared";

export interface Verification {
  id: string;
  userId: string;
  documentType: string;
  documentNumber: string;
  status: VerificationStatus;
  decision: string | null;
  decisionReason: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
