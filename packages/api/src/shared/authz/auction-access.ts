import type { Role } from "@auction/shared";
import { queryOne } from "../../infrastructure/database/query.js";
import { AppError, HttpStatus } from "../errors/index.js";

export interface AuctionOwner {
  auctionId: string;
  orgId: string;
  status: string;
  createdBy: string;
}

export interface AccessActor {
  userId: string;
  roles: Role[];
  organizationId?: string;
}

/**
 * Loads the owning organization of an auction.
 *
 * Kept deliberately narrow (three columns, no lock) so it is cheap enough to
 * call as a guard at the top of every organization-scoped handler.
 */
export async function findAuctionOwner(auctionId: string): Promise<AuctionOwner | null> {
  const row = await queryOne<{
    id: string;
    org_id: string;
    status: string;
    created_by: string;
  }>(`SELECT id, org_id, status, created_by FROM auctions WHERE id = $1`, [auctionId]);

  if (!row) return null;
  return {
    auctionId: row.id,
    orgId: row.org_id,
    status: row.status,
    createdBy: row.created_by,
  };
}

/**
 * Asserts that `actor` is entitled to act on `auctionId` on behalf of the
 * organization that owns it.
 *
 * This closes a systemic multi-tenancy hole: role checks alone only proved
 * the caller was *an* auction officer somewhere, never that they were an
 * officer of *this* auction's organization. Without it, an officer at one
 * body could edit lots, run compliance checks, open sealed bids, publish
 * reports and read deposits belonging to a completely different body.
 *
 * `super_admin` is the sole exception, since platform operators legitimately
 * work across organizations.
 */
export async function assertAuctionAccess(
  auctionId: string,
  actor: AccessActor,
): Promise<AuctionOwner> {
  const auction = await findAuctionOwner(auctionId);
  if (!auction) {
    throw new AppError("Auction not found", HttpStatus.NOT_FOUND, "AUCTION_NOT_FOUND");
  }

  if (actor.roles.includes("super_admin")) {
    return auction;
  }

  if (!actor.organizationId) {
    throw new AppError(
      "Organization context required. Select an organization via POST /api/v1/auth/context.",
      HttpStatus.FORBIDDEN,
      "ORG_CONTEXT_REQUIRED",
    );
  }

  if (actor.organizationId !== auction.orgId) {
    // Deliberately the same shape as any other 403 — confirming that the
    // auction exists but belongs elsewhere would leak the org boundary.
    throw new AppError("Forbidden", HttpStatus.FORBIDDEN, "FORBIDDEN");
  }

  return auction;
}

/** True when the actor holds any role that can act for an organization. */
export function isOfficer(roles: Role[]): boolean {
  return roles.some((role) =>
    ["auction_officer", "org_admin", "compliance_officer", "super_admin"].includes(role),
  );
}
