import type { CreateAuctionItemRequest, Role, UpdateAuctionItemRequest } from "@auction/shared";
import { AppError, HttpStatus } from "../shared/errors/index.js";
import { assertAuctionAccess } from "../shared/authz/auction-access.js";
import * as audit from "../audit/audit.service.js";
import * as repo from "./auction-item.repository.js";
import type { AuctionItemRecord } from "./auction-item.types.js";

export interface ItemActor {
  userId: string;
  roles: Role[];
  organizationId?: string;
}

async function assertEditable(auctionId: string, actor: ItemActor): Promise<void> {
  const auction = await assertAuctionAccess(auctionId, actor);

  if (auction.status !== "draft") {
    throw new AppError(
      "Auction items can only be modified while the auction is in draft state",
      HttpStatus.UNPROCESSABLE,
    );
  }
}

export async function createAuctionItem(
  actor: ItemActor,
  auctionId: string,
  data: CreateAuctionItemRequest,
): Promise<AuctionItemRecord> {
  await assertEditable(auctionId, actor);

  const item = await repo.createAuctionItem(actor.userId, auctionId, data);

  await audit.appendAuditEvent({
    auctionId,
    actorId: actor.userId,
    actorRole: audit.actorRoleOf(actor.roles),
    entityType: "auction_item",
    entityId: item.id,
    action: "auction_item.created",
    payload: { title: item.title, quantity: item.quantity, estimatedValue: item.estimatedValue },
  });

  return item;
}

export async function getAuctionItems(auctionId: string): Promise<AuctionItemRecord[]> {
  return repo.getAuctionItems(auctionId);
}

export async function getAuctionItemById(id: string): Promise<AuctionItemRecord> {
  const item = await repo.getAuctionItemById(id);
  if (!item) {
    throw new AppError("Auction item not found", HttpStatus.NOT_FOUND);
  }
  return item;
}

export async function updateAuctionItem(
  actor: ItemActor,
  auctionId: string,
  id: string,
  data: UpdateAuctionItemRequest,
): Promise<AuctionItemRecord> {
  await assertEditable(auctionId, actor);

  const item = await getAuctionItemById(id);
  if (item.auctionId !== auctionId) {
    throw AppError.badRequest("Item does not belong to this auction");
  }

  const updated = await repo.updateAuctionItem(actor.userId, id, data);

  await audit.appendAuditEvent({
    auctionId,
    actorId: actor.userId,
    actorRole: audit.actorRoleOf(actor.roles),
    entityType: "auction_item",
    entityId: id,
    action: "auction_item.updated",
    payload: { fields: Object.keys(data) },
  });

  return updated;
}

export async function deleteAuctionItem(
  actor: ItemActor,
  auctionId: string,
  id: string,
): Promise<void> {
  await assertEditable(auctionId, actor);

  const item = await getAuctionItemById(id);
  if (item.auctionId !== auctionId) {
    throw AppError.badRequest("Item does not belong to this auction");
  }

  await repo.deleteAuctionItem(actor.userId, id);

  await audit.appendAuditEvent({
    auctionId,
    actorId: actor.userId,
    actorRole: audit.actorRoleOf(actor.roles),
    entityType: "auction_item",
    entityId: id,
    action: "auction_item.deleted",
    payload: { title: item.title },
  });
}
