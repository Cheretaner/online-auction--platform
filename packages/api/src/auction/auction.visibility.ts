import type { AuthContext } from "../shared/types/request.js";
import { isOrgOfficer } from "../bidding/bidding.repository.js";

/** Statuses the public catalogue shows. Anything else (draft, pending
 * review, approved-but-unscheduled, cancelled) is visible only to the owning
 * organization's staff and to super admins. */
export const PUBLIC_AUCTION_STATUSES = ["scheduled", "live", "closed", "under_review", "awarded"] as const;

export function isPublicStatus(status: string): boolean {
  return (PUBLIC_AUCTION_STATUSES as readonly string[]).includes(status);
}

/** True when the caller may see internal detail for the auction: officers of
 * the owning organization and super admins. */
export async function isAuctionStaff(orgId: string, auth: AuthContext | undefined): Promise<boolean> {
  if (!auth) return false;
  if (auth.roles.includes("super_admin")) return true;
  return isOrgOfficer(orgId, auth.userId);
}

export async function canViewAuction(
  auction: { orgId: string; status: string },
  auth: AuthContext | undefined,
): Promise<boolean> {
  return isPublicStatus(auction.status) || isAuctionStaff(auction.orgId, auth);
}
