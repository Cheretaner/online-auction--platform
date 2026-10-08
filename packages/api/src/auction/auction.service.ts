import type { AuctionStatus, CreateAuctionRequest, Role, UpdateAuctionRequest } from "@auction/shared";
import { DOMAIN_EVENTS } from "../kernel/events.js";
import { compareMoney } from "../kernel/money.js";
import { enqueueOutbox } from "../infrastructure/outbox/outbox.repository.js";
import { withTransaction } from "../infrastructure/database/tx.js";
import { AppError, HttpStatus } from "../shared/errors/index.js";
import { logger } from "../shared/utils/logger.js";
import { issueRefundLetters } from "../settlement/refund-letter.service.js";
import * as settlementRepo from "../settlement/settlement.repository.js";
import * as audit from "../audit/audit.service.js";
import * as biddingRepo from "../bidding/bidding.repository.js";
import * as notifications from "../notification/notification.service.js";
import * as AuctionRepo from "./auction.repository.js";
import * as anomalyRepo from "../ai/ai.repository.js";
import { canTransition } from "./auction.stateMachine.js";
import type { Auction } from "./auction.types.js";
import type { AuthContext } from "../shared/types/request.js";
import { canViewAuction } from "./auction.visibility.js";

export interface AuctionActor {
  userId: string;
  roles: Role[];
  organizationId?: string;
}

/** Ensures the auction exists and belongs to the caller's organization. */
async function loadOwned(id: string, orgId: string, client?: Parameters<typeof AuctionRepo.findById>[1]) {
  const auction = await AuctionRepo.lockById(id, client);
  if (!auction) throw new AppError("Auction not found", HttpStatus.NOT_FOUND, "AUCTION_NOT_FOUND");
  if (auction.orgId !== orgId) throw new AppError("Forbidden", HttpStatus.FORBIDDEN, "FORBIDDEN");
  return auction;
}

function assertWindow(opensAt: string | Date, closesAt: string | Date): void {
  if (new Date(closesAt) <= new Date(opensAt)) {
    throw AppError.badRequest("closesAt must be after opensAt");
  }
}

export async function createAuction(
  orgId: string,
  actor: AuctionActor,
  data: CreateAuctionRequest,
): Promise<Auction> {
  assertWindow(data.opensAt, data.closesAt);

  if (data.reservePrice && compareMoney(data.reservePrice, data.startPrice) < 0) {
    throw AppError.badRequest("reservePrice cannot be below startPrice");
  }

  return withTransaction(
    async (client) => {
      const auction = await AuctionRepo.createAuction(orgId, actor.userId, data, client);

      await audit.appendAuditEvent({
        auctionId: auction.id,
        actorId: actor.userId,
        actorRole: audit.actorRoleOf(actor.roles),
        entityType: "auction",
        entityId: auction.id,
        action: "auction.created",
        payload: { title: auction.title, auctionType: auction.auctionType, status: auction.status },
      });

      return auction;
    },
    { userId: actor.userId, organizationId: orgId },
  );
}

export async function getAuction(id: string, viewer?: AuthContext): Promise<Auction> {
  const auction = await AuctionRepo.findById(id);
  // A draft or pending auction is answered with the same 404 as a missing
  // one, so outsiders cannot probe which ids exist.
  if (!auction || !(await canViewAuction(auction, viewer))) {
    throw new AppError("Auction not found", HttpStatus.NOT_FOUND, "AUCTION_NOT_FOUND");
  }
  return auction;
}

export async function listPublicAuctions(filters: AuctionRepo.PublicAuctionFilters) {
  return AuctionRepo.listPublicAuctions(filters);
}

export async function listByOrg(
  orgId: string,
  filters: { status?: Auction["status"]; limit: number } = { limit: 50 },
): Promise<Auction[]> {
  const result = await AuctionRepo.listByOrgId(orgId, filters.limit, undefined, undefined, filters.status);
  return result.items;
}

export async function submitForApproval(
  id: string,
  orgId: string,
  actor: AuctionActor,
): Promise<Auction> {
  return withTransaction(
    async (client) => {
      const auction = await loadOwned(id, orgId, client);

      if (!canTransition(auction.status, "pending_review")) {
        throw AppError.unprocessable(
          `Cannot transition from ${auction.status} to pending_review`,
        );
      }

      const items = await biddingRepo.countAuctionItems(auction.id);
      if (items === 0) {
        throw AppError.unprocessable("An auction must have at least one item before review");
      }

      const updated = await AuctionRepo.updateStatus(id, "pending_review", null, client);

      await audit.appendAuditEvent({
        auctionId: auction.id,
        actorId: actor.userId,
        actorRole: audit.actorRoleOf(actor.roles),
        entityType: "auction",
        entityId: auction.id,
        action: "auction.submitted",
        payload: { from: auction.status, to: "pending_review" },
      });

      return updated;
    },
    { userId: actor.userId, organizationId: orgId },
  );
}

export async function approveAuction(
  id: string,
  orgId: string,
  actor: AuctionActor,
): Promise<Auction> {
  return withTransaction(
    async (client) => {
      const auction = await loadOwned(id, orgId, client);

      // Two-person rule, mirrored by auctions_approval_two_person_rule in
      // the schema so it holds even if this check is ever bypassed.
      if (auction.createdBy === actor.userId) {
        throw AppError.unprocessable(
          "Two-person rule: you cannot approve an auction you created",
          "APPROVAL_SELF",
        );
      }

      if (!canTransition(auction.status, "scheduled")) {
        throw AppError.unprocessable(`Cannot transition from ${auction.status} to scheduled`);
      }

      const updated = await AuctionRepo.updateStatus(id, "scheduled", actor.userId, client);

      await audit.appendAuditEvent({
        auctionId: auction.id,
        actorId: actor.userId,
        actorRole: audit.actorRoleOf(actor.roles),
        entityType: "auction",
        entityId: auction.id,
        action: "auction.approved",
        payload: { approvedBy: actor.userId, createdBy: auction.createdBy },
      });

      await enqueueOutbox({
        aggregateType: "auction",
        aggregateId: auction.id,
        eventType: "auction.approved",
        payload: { auctionId: auction.id, opensAt: updated.opensAt.toISOString() },
      });

      return updated;
    },
    { userId: actor.userId, organizationId: orgId },
  );
}

export async function transitionAuction(
  id: string,
  orgId: string,
  status: AuctionStatus,
  actor: AuctionActor,
): Promise<Auction> {
  return withTransaction(
    async (client) => {
      const auction = await loadOwned(id, orgId, client);

      if (!canTransition(auction.status, status)) {
        throw AppError.unprocessable(`Cannot transition from ${auction.status} to ${status}`);
      }

      // Awarding is the terminal, publishable outcome, so it must not be
      // reachable while the audit ledger for this auction is broken.
      if (status === "awarded") {
        if (!auction.winnerId || !auction.winningAmount) {
          throw AppError.unprocessable("An auction without a confirmed winner and winning amount cannot be awarded");
        }
        // FR15: an unresolved high-severity anomaly keeps the outcome
        // provisional until compliance has reviewed it.
        const openHigh = await anomalyRepo.countOpenHigh(auction.id);
        if (openHigh > 0) {
          throw AppError.unprocessable(
            "Cannot award while a high-severity anomaly flag is still open. Review it first.",
          );
        }
        const chain = await audit.verifyAuditChain(auction.id);
        if (!chain.intact) {
          throw AppError.unprocessable(
            "Cannot award an auction whose audit chain is not intact",
            "CHAIN_BROKEN",
          );
        }
      }

      const updated =
        status === "awarded"
          ? await AuctionRepo.markAwarded(id, client)
          : await AuctionRepo.updateStatus(id, status, undefined, client);

      if (!updated) throw new AppError("Auction not found", HttpStatus.NOT_FOUND, "AUCTION_NOT_FOUND");

      if (status === "awarded" && updated.winnerId && updated.winningAmount) {
        await settlementRepo.createForAward({
          auctionId: updated.id,
          winnerId: updated.winnerId,
          amount: updated.winningAmount,
        }, client);
      }

      await audit.appendAuditEvent({
        auctionId: auction.id,
        actorId: actor.userId,
        actorRole: audit.actorRoleOf(actor.roles),
        entityType: "auction",
        entityId: auction.id,
        action: `auction.${status}`,
        payload: { from: auction.status, to: status },
      });

      if (status === "awarded" || status === "under_review") {
        await enqueueOutbox({
          aggregateType: "auction",
          aggregateId: auction.id,
          eventType: `auction.${status}`,
          payload: {
            auctionId: auction.id,
            from: auction.status,
            to: status,
            winnerId: updated.winnerId,
            winningAmount: updated.winningAmount,
          },
        });
      }

      return updated;
    },
    { userId: actor.userId, organizationId: orgId },
  );
}

export async function amendAuction(
  id: string,
  orgId: string,
  data: UpdateAuctionRequest,
  actor: AuctionActor,
): Promise<Auction> {
  return withTransaction(
    async (client) => {
      const auction = await loadOwned(id, orgId, client);

      if (auction.status !== "draft") {
        throw AppError.unprocessable("Only draft auctions can be amended");
      }

      const opensAt = data.opensAt ?? auction.opensAt;
      const closesAt = data.closesAt ?? auction.closesAt;
      assertWindow(opensAt, closesAt);

      const startPrice = data.startPrice ?? auction.startPrice;
      const reservePrice = data.reservePrice ?? auction.reservePrice;
      if (reservePrice && compareMoney(reservePrice, startPrice) < 0) {
        throw AppError.badRequest("reservePrice cannot be below startPrice");
      }

      const updated = await AuctionRepo.updateAuction(id, data, client);

      await audit.appendAuditEvent({
        auctionId: auction.id,
        actorId: actor.userId,
        actorRole: audit.actorRoleOf(actor.roles),
        entityType: "auction",
        entityId: auction.id,
        action: "auction.amended",
        payload: { fields: Object.keys(data) },
      });

      return updated;
    },
    { userId: actor.userId, organizationId: orgId },
  );
}

export async function cancelAuction(
  id: string,
  orgId: string,
  actor: AuctionActor,
  reason?: string,
): Promise<Auction> {
  return withTransaction(
    async (client) => {
      const auction = await loadOwned(id, orgId, client);

      if (!canTransition(auction.status, "cancelled")) {
        throw AppError.unprocessable(`Cannot cancel an auction in status ${auction.status}`);
      }

      const updated = await AuctionRepo.markCancelled(id, reason ?? null, client);
      if (!updated) throw new AppError("Auction not found", HttpStatus.NOT_FOUND, "AUCTION_NOT_FOUND");

      await audit.appendAuditEvent({
        auctionId: auction.id,
        actorId: actor.userId,
        actorRole: audit.actorRoleOf(actor.roles),
        entityType: "auction",
        entityId: auction.id,
        action: "auction.cancelled",
        payload: { from: auction.status, reason: reason ?? null },
      });

      await enqueueOutbox({
        aggregateType: "auction",
        aggregateId: auction.id,
        eventType: "auction.cancelled",
        payload: { auctionId: auction.id, reason: reason ?? null },
      });

      return updated;
    },
    { userId: actor.userId, organizationId: orgId },
  );
}

/**
 * Flags an auction as requiring human review — raised by a dispute (FR14)
 * or an unresolved high-severity anomaly (FR15), which make the outcome
 * provisional rather than final.
 *
 * Deliberately tolerant: it is called from paths whose primary job is
 * something else, so an auction that is already under review, cancelled or
 * awarded is a no-op rather than an error. `actorId` is null for
 * system-raised reviews.
 */
export async function markUnderReviewIfNeeded(input: {
  auctionId: string;
  actorId: string | null;
  actorRole: string;
  reason: string;
}): Promise<Auction | null> {
  return withTransaction(
    async (client) => {
      const auction = await AuctionRepo.lockById(input.auctionId, client);
      if (!auction) return null;
      if (auction.status !== "live" && auction.status !== "closed") {
        return null;
      }

      const updated = await AuctionRepo.markUnderReview(input.auctionId, client);
      if (!updated) return null;

      await audit.appendAuditEvent({
        auctionId: auction.id,
        actorId: input.actorId,
        actorRole: input.actorRole,
        entityType: "auction",
        entityId: auction.id,
        action: DOMAIN_EVENTS.AUCTION_UNDER_REVIEW,
        payload: { from: auction.status, reason: input.reason },
      });

      await enqueueOutbox({
        aggregateType: "auction",
        aggregateId: auction.id,
        eventType: DOMAIN_EVENTS.AUCTION_UNDER_REVIEW,
        payload: { auctionId: auction.id, reason: input.reason },
      });

      return updated;
    },
    input.actorId ? { userId: input.actorId } : undefined,
  );
}

/**
 * Publishes every scheduled auction whose opening time has passed.
 * Returns how many were opened. Driven by the scheduler.
 */
export async function openDueAuctions(now = new Date()): Promise<number> {
  const due = await AuctionRepo.findDueToOpen(now);
  let opened = 0;

  for (const candidate of due) {
    try {
      const result = await withTransaction(async (client) => {
        // Re-read under a lock: another instance may have opened it between
        // the sweep query and now.
        const auction = await AuctionRepo.lockById(candidate.id, client);
        if (!auction || auction.status !== "scheduled" || auction.opensAt > now) {
          return null;
        }

        const updated = await AuctionRepo.markLive(auction.id, client);
        if (!updated) return null;

        await audit.appendAuditEvent({
          auctionId: auction.id,
          actorId: null,
          actorRole: "system",
          entityType: "auction",
          entityId: auction.id,
          action: "auction.opened",
          payload: { opensAt: auction.opensAt.toISOString() },
        });

        await enqueueOutbox({
          aggregateType: "auction",
          aggregateId: auction.id,
          eventType: "auction.opened",
          payload: { auctionId: auction.id, closesAt: updated.closesAt.toISOString() },
        });

        return updated;
      });

      if (result) opened += 1;
    } catch (error) {
      logger.error({ err: error, auctionId: candidate.id }, "Failed to open auction");
    }
  }

  return opened;
}

/**
 * Closes every live auction whose (possibly extended) closing time has
 * passed, and records the provisional outcome.
 *
 * Open ascending auctions get a winner immediately, provided the reserve
 * is met. Sealed-bid auctions are closed but never auto-awarded: their
 * amounts stay hidden until an officer runs the opening ceremony
 * (POST /auctions/:id/bids/open-sealed), which is what makes the sealed
 * process auditable.
 */
export async function closeDueAuctions(now = new Date()): Promise<number> {
  const due = await AuctionRepo.findDueToClose(now);
  let closed = 0;

  for (const candidate of due) {
    try {
      const result = await withTransaction(async (client) => {
        const auction = await AuctionRepo.lockById(candidate.id, client);
        if (!auction || auction.status !== "live" || auction.closesAt > now) {
          // An anti-snipe extension may have pushed closes_at out after the
          // sweep read it.
          return null;
        }

        let winnerId: string | null = null;
        let winningAmount: string | null = null;

        if (auction.auctionType === "open_ascending") {
          const leading = await biddingRepo.findLeadingBid(auction.id);
          const reserveMet =
            leading !== null &&
            (auction.reservePrice === null ||
              compareMoney(leading.amount, auction.reservePrice) >= 0);

          if (leading && reserveMet) {
            winnerId = leading.bidderId;
            winningAmount = leading.amount;
          }
        }

        const noSale = auction.auctionType === "open_ascending" && !winnerId;
        const cancellationReason = noSale
          ? auction.reservePrice
            ? "Reserve price not met"
            : "No bids received"
          : null;
        const updated = noSale
          ? await AuctionRepo.markCancelled(auction.id, cancellationReason, client)
          : await AuctionRepo.closeWithOutcome(auction.id, { winnerId, winningAmount }, client);
        if (!updated) return null;

        await audit.appendAuditEvent({
          auctionId: auction.id,
          actorId: null,
          actorRole: "system",
          entityType: "auction",
          entityId: auction.id,
          action: noSale ? "auction.cancelled" : "auction.closed",
          payload: {
            closesAt: auction.closesAt.toISOString(),
            auctionType: auction.auctionType,
            winnerId,
            winningAmount,
            reservePrice: auction.reservePrice,
            cancellationReason,
          },
        });

        await enqueueOutbox({
          aggregateType: "auction",
          aggregateId: auction.id,
          eventType: noSale ? "auction.cancelled" : "auction.closed",
          payload: { auctionId: auction.id, winnerId, winningAmount, cancellationReason },
        });

        return { auction: updated, winnerId };
      });

      if (!result) continue;
      closed += 1;

      if (result.winnerId) {
        await notifications.enqueueNotification({
          userId: result.winnerId,
          channel: "in_app",
          type: "auction.won",
          title: "You are the leading bidder",
          message: `Bidding has closed on "${result.auction.title}". The outcome is provisional until it is reviewed and awarded.`,
          relatedEntityType: "auction",
          relatedEntityId: result.auction.id,
        });
      }
      await issueRefundLetters(result.auction.id, result.winnerId, result.auction.createdBy);

      const officers = await biddingRepo.listOrgOfficerIds(result.auction.orgId);
      await notifications.notifyMany(
        officers.map((userId) => ({
          userId,
          channel: "in_app" as const,
          type: result.auction.status === "cancelled" ? "auction.cancelled" : "auction.closed",
          title: result.auction.status === "cancelled" ? "Auction cancelled" : "Auction closed",
          message: result.auction.status === "cancelled"
            ? `"${result.auction.title}" did not meet its reserve or receive a qualifying bid.`
            : `"${result.auction.title}" has closed and is ready for review.`,
          relatedEntityType: "auction",
          relatedEntityId: result.auction.id,
        })),
      );
    } catch (error) {
      logger.error({ err: error, auctionId: candidate.id }, "Failed to close auction");
    }
  }

  return closed;
}
