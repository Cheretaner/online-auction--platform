import { env } from "../config/env.js";
import { hashIp } from "../kernel/crypto.js";
import { DOMAIN_EVENTS } from "../kernel/events.js";
import { maxMoney } from "../kernel/money.js";
import { isUniqueViolation } from "../kernel/pg.js";
import { primaryActorRole } from "../kernel/roles.js";
import { enqueueOutbox } from "../infrastructure/outbox/outbox.repository.js";
import { withTransaction } from "../infrastructure/database/tx.js";
import { AppError, HttpStatus } from "../shared/errors/index.js";
import type { PlaceBidRequest } from "@auction/shared";
import * as audit from "../audit/audit.service.js";
import * as notifications from "../notification/notification.service.js";
import * as anomaly from "../ai/anomaly.service.js";
import * as repo from "./bidding.repository.js";
import { BiddingError } from "./bidding.errors.js";
import { assertBidPlacement } from "./placement.policy.js";
import { computeAntiSnipe } from "./bidding.rules.js";
import type { BidRecord, PlaceBidResult } from "./bidding.types.js";
import { toPublicBid } from "./bidding.visibility.js";

function requireKey(idempotencyKey?: string): string {
  if (!idempotencyKey) {
    throw new AppError("Idempotency-Key is required", HttpStatus.BAD_REQUEST, "IDEMPOTENCY_KEY_REQUIRED");
  }
  return idempotencyKey;
}

export async function placeBid(input: {
  auctionId: string;
  bidderId: string;
  roles: import("@auction/shared").Role[];
  organizationId?: string;
  body: PlaceBidRequest;
  idempotencyKey?: string;
  ip?: string;
}): Promise<PlaceBidResult> {
  const idempotencyKey = requireKey(input.idempotencyKey);

  return withTransaction(
    async () => {
      const existing = await repo.findBidByIdempotencyKey(idempotencyKey);
      if (existing) {
        if (existing.auctionId !== input.auctionId || existing.bidderId !== input.bidderId) {
          throw new AppError("Idempotency key already used", HttpStatus.CONFLICT, "IDEMPOTENT_REPLAY");
        }
        const auction = await repo.findAuction(input.auctionId);
        if (!auction) throw new AppError("Auction not found", HttpStatus.NOT_FOUND);
        return {
          bid: existing,
          auction: {
            currentHighestBid: auction.auctionType === "sealed_bid" && !auction.sealedOpenedAt
              ? auction.startPrice
              : auction.currentHighestBid,
            bidCount: auction.bidCount,
            closesAt: auction.closesAt.toISOString(),
            extended: false,
          },
          audit: { eventId: existing.id, sequenceNo: 0, hash: existing.commitmentHash ?? existing.id },
        };
      }

      const auction = await repo.lockAuction(input.auctionId);
      if (!auction) throw new AppError("Auction not found", HttpStatus.NOT_FOUND);

      const bidder = await repo.findBidder(input.bidderId);
      if (!bidder) throw new AppError("Bidder not found", HttpStatus.NOT_FOUND);

      const isOrgOfficer = await repo.isOrgOfficer(auction.orgId, input.bidderId);
      const depositVerified = await repo.hasVerifiedDeposit(
        auction.id,
        input.bidderId,
        auction.depositAmount,
      );

      assertBidPlacement({
        auction,
        bidder,
        amount: input.body.amount,
        now: new Date(),
        commitmentHash: input.body.commitmentHash,
        isOrgOfficer,
        depositVerified,
      });

      const isSealed = auction.auctionType === "sealed_bid";
      const antiSnipe = isSealed
        ? { extended: false, closesAt: auction.closesAt, extensionCount: auction.extensionCount }
        : computeAntiSnipe({
            now: new Date(),
            closesAt: auction.closesAt,
            antiSnipeSeconds: auction.antiSnipeSeconds,
            extensionCount: auction.extensionCount,
            maxExtensions: auction.maxExtensions,
          });

      let bid: BidRecord;
      try {
        bid = await repo.insertBid({
          auctionId: auction.id,
          bidderId: input.bidderId,
          amount: input.body.amount,
          isSealed,
          commitmentHash: input.body.commitmentHash ?? null,
          idempotencyKey,
          ipHash: hashIp(input.ip, env.JWT_SECRET),
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          const replay = await repo.findBidByIdempotencyKey(idempotencyKey);
          if (replay) {
            throw new AppError("Duplicate bid request", HttpStatus.CONFLICT, "IDEMPOTENT_REPLAY", replay);
          }
        }
        throw error;
      }

      if (!isSealed) {
        await repo.supersedeOtherActiveBids(auction.id, input.bidderId, bid.id);
      }

      const tallies = await repo.countActiveBids(auction.id);
      const highest = isSealed ? auction.currentHighestBid : maxMoney(tallies.highest, input.body.amount);
      const updated = await repo.applyAuctionBidState({
        auctionId: auction.id,
        highestBid: isSealed ? auction.currentHighestBid : highest,
        bidCountDelta: 1,
        closesAt: antiSnipe.closesAt,
        extensionCount: antiSnipe.extensionCount,
      });

      const event = await audit.appendAuditEvent({
        auctionId: auction.id,
        actorId: input.bidderId,
        actorRole: primaryActorRole(input.roles),
        entityType: "bid",
        entityId: bid.id,
        action: DOMAIN_EVENTS.BID_PLACED,
        payload: {
          amount: isSealed ? null : bid.amount,
          isSealed,
          commitmentHash: bid.commitmentHash,
          extended: antiSnipe.extended,
        },
      });

      await enqueueOutbox({
        aggregateType: "auction",
        aggregateId: auction.id,
        eventType: DOMAIN_EVENTS.BID_PLACED,
        payload: {
          auctionId: auction.id,
          bidId: bid.id,
          bidderId: bid.bidderId,
          amount: isSealed ? null : bid.amount,
          bidCount: updated.bidCount,
          currentHighestBid: isSealed ? null : updated.currentHighestBid,
          closesAt: updated.closesAt.toISOString(),
          extended: antiSnipe.extended,
        },
      });

      if (antiSnipe.extended) {
        await enqueueOutbox({
          aggregateType: "auction",
          aggregateId: auction.id,
          eventType: DOMAIN_EVENTS.AUCTION_EXTENDED,
          payload: {
            auctionId: auction.id,
            closesAt: updated.closesAt.toISOString(),
            extensionCount: updated.extensionCount,
          },
        });
      }

      const officers = await repo.listOrgOfficerIds(auction.orgId);
      await notifications.notifyMany(
        officers.map((userId) => ({
          userId,
          channel: "in_app" as const,
          type: "bid.placed",
          title: isSealed ? "Sealed bid received" : "New bid placed",
          message: isSealed
            ? `A sealed bid was recorded on "${auction.title}".`
            : `A bid of ${bid.amount} was placed on "${auction.title}".`,
          relatedEntityType: "bid",
          relatedEntityId: bid.id,
        })),
      );

      void anomaly.evaluateAuction(auction.id).catch(() => undefined);

      return {
        bid,
        auction: {
          currentHighestBid: isSealed ? updated.startPrice : updated.currentHighestBid,
          bidCount: updated.bidCount,
          closesAt: updated.closesAt.toISOString(),
          extended: antiSnipe.extended,
        },
        audit: {
          eventId: event.id,
          sequenceNo: event.sequenceNo,
          hash: event.hash,
        },
      };
    },
    { userId: input.bidderId, organizationId: input.organizationId },
  );
}

export async function listBids(input: {
  auctionId: string;
  viewerId: string;
  roles: import("@auction/shared").Role[];
}) {
  const auction = await repo.findAuction(input.auctionId);
  if (!auction) throw new AppError("Auction not found", HttpStatus.NOT_FOUND);
  const officer = await repo.isOrgOfficer(auction.orgId, input.viewerId);
  const bids = await repo.listBids(input.auctionId);
  return bids.map((bid) => toPublicBid(bid, auction, { viewerId: input.viewerId, isOfficer: officer }));
}

export async function withdrawBid(input: {
  auctionId: string;
  bidId: string;
  bidderId: string;
  roles: import("@auction/shared").Role[];
  reason: string;
}): Promise<BidRecord> {
  return withTransaction(async () => {
    const auction = await repo.lockAuction(input.auctionId);
    if (!auction) throw new AppError("Auction not found", HttpStatus.NOT_FOUND);
    if (auction.status !== "live") {
      throw new BiddingError("Auction is not live", "AUCTION_NOT_LIVE");
    }
    if (auction.auctionType === "sealed_bid") {
      throw new BiddingError("Sealed bids cannot be withdrawn", "NOT_ELIGIBLE");
    }

    const bid = await repo.findBid(input.bidId);
    if (!bid || bid.auctionId !== input.auctionId) {
      throw new AppError("Bid not found", HttpStatus.NOT_FOUND, "BID_NOT_FOUND");
    }
    if (bid.bidderId !== input.bidderId) {
      throw new AppError("Forbidden", HttpStatus.FORBIDDEN);
    }
    if (bid.status !== "active") {
      throw new BiddingError("Bid cannot be withdrawn", "NOT_ELIGIBLE");
    }

    const withdrawn = await repo.withdrawBid(bid.id, input.reason);
    const tallies = await repo.countActiveBids(auction.id);
    await repo.applyAuctionBidState({
      auctionId: auction.id,
      highestBid: tallies.highest,
      bidCountDelta: 0,
      closesAt: auction.closesAt,
      extensionCount: auction.extensionCount,
      replaceHighest: true,
    });

    await audit.appendAuditEvent({
      auctionId: auction.id,
      actorId: input.bidderId,
      actorRole: primaryActorRole(input.roles),
      entityType: "bid",
      entityId: bid.id,
      action: DOMAIN_EVENTS.BID_WITHDRAWN,
      payload: { reason: input.reason },
    });

    await enqueueOutbox({
      aggregateType: "auction",
      aggregateId: auction.id,
      eventType: DOMAIN_EVENTS.BID_WITHDRAWN,
      payload: { auctionId: auction.id, bidId: bid.id },
    });

    return withdrawn;
  }, { userId: input.bidderId });
}

export async function openSealedBids(input: {
  auctionId: string;
  actorId: string;
  roles: import("@auction/shared").Role[];
  organizationId?: string;
}) {
  return withTransaction(async () => {
    const auction = await repo.lockAuction(input.auctionId);
    if (!auction) throw new AppError("Auction not found", HttpStatus.NOT_FOUND);
    if (auction.auctionType !== "sealed_bid") {
      throw new BiddingError("Auction is not a sealed bid", "NOT_ELIGIBLE");
    }
    if (auction.status !== "closed" && auction.status !== "under_review") {
      throw new BiddingError("Sealed bids can only be opened after close", "AUCTION_NOT_CLOSED");
    }
    const officer = await repo.isOrgOfficer(auction.orgId, input.actorId);
    if (!officer) throw new AppError("Forbidden", HttpStatus.FORBIDDEN);
    if (auction.sealedOpenedAt) {
      return { openedAt: auction.sealedOpenedAt.toISOString(), alreadyOpen: true };
    }

    const opened = await repo.markSealedOpened(auction.id, input.actorId);
    const leading = await repo.findLeadingBid(auction.id);

    await audit.appendAuditEvent({
      auctionId: auction.id,
      actorId: input.actorId,
      actorRole: primaryActorRole(input.roles),
      entityType: "auction",
      entityId: auction.id,
      action: DOMAIN_EVENTS.SEALED_OPENED,
      payload: { leadingBidId: leading?.id ?? null, leadingAmount: leading?.amount ?? null },
    });

    await enqueueOutbox({
      aggregateType: "auction",
      aggregateId: auction.id,
      eventType: DOMAIN_EVENTS.SEALED_OPENED,
      payload: { auctionId: auction.id, leadingBidId: leading?.id ?? null },
    });

    return {
      openedAt: opened.sealedOpenedAt?.toISOString(),
      alreadyOpen: false,
      leadingBid: leading,
    };
  }, { userId: input.actorId, organizationId: input.organizationId });
}
