import { useAuth } from "@/features/auth/auth-provider";
import { useMyDeposits, useMyVerification } from "@/features/operations/queries";
import type { Auction, DepositRecord } from "@/lib/api/types";

export interface BidderReadiness {
  loading: boolean;
  kycStatus: string;
  depositRequired: boolean;
  deposit: DepositRecord | undefined;
  ready: boolean;
}

/** What still stands between this bidder and a valid bid on `auction`,
 * mirroring the API's eligibility rules (placement.policy.ts). */
export function useBidderReadiness(auction: Auction): BidderReadiness {
  const { session } = useAuth();
  const verification = useMyVerification();
  const deposits = useMyDeposits();
  const kycStatus =
    session?.user.verificationStatus === "verified"
      ? "verified"
      : (verification.data?.status ?? session?.user.verificationStatus ?? "unverified");
  const depositRequired = Number(auction.depositAmount) > 0;
  const deposit = deposits.data?.items
    .filter((item) => item.auctionId === auction.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const depositOk = !depositRequired || deposit?.status === "verified";
  return {
    loading: verification.isLoading || deposits.isLoading,
    kycStatus,
    depositRequired,
    deposit,
    ready: kycStatus === "verified" && depositOk,
  };
}
