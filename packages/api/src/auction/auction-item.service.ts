import { queryOne } from "../infrastructure/database/query.js";
import { AppError, HttpStatus } from "../shared/errors/index.js";
import type { CreateAuctionItemRequest, UpdateAuctionItemRequest } from "@auction/shared";
import * as repo from "./auction-item.repository.js";

async function verifyAuctionDraftStatus(auctionId: string): Promise<void> {
  const auction = await queryOne<{ status: string }>(
    `SELECT status FROM auctions WHERE id = $1`,
    [auctionId]
  );
  
  if (!auction) {
    throw new AppError(HttpStatus.NOT_FOUND, 'Auction not found');
  }
  
  if (auction.status !== 'draft') {
    throw new AppError(
      HttpStatus.BAD_REQUEST,
      'Auction items can only be modified when the auction is in draft state'
    );
  }
}

export async function createAuctionItem(userId: string, auctionId: string, data: CreateAuctionItemRequest) {
  await verifyAuctionDraftStatus(auctionId);
  return repo.createAuctionItem(userId, auctionId, data);
}

export async function getAuctionItems(auctionId: string) {
  return repo.getAuctionItems(auctionId);
}

export async function getAuctionItemById(id: string) {
  const item = await repo.getAuctionItemById(id);
  if (!item) {
    throw new AppError(HttpStatus.NOT_FOUND, 'Auction item not found');
  }
  return item;
}

export async function updateAuctionItem(userId: string, auctionId: string, id: string, data: UpdateAuctionItemRequest) {
  await verifyAuctionDraftStatus(auctionId);
  const item = await getAuctionItemById(id);
  if (item.auctionId !== auctionId) {
    throw new AppError(HttpStatus.BAD_REQUEST, 'Item does not belong to this auction');
  }
  return repo.updateAuctionItem(userId, id, data);
}

export async function deleteAuctionItem(userId: string, auctionId: string, id: string) {
  await verifyAuctionDraftStatus(auctionId);
  const item = await getAuctionItemById(id);
  if (item.auctionId !== auctionId) {
    throw new AppError(HttpStatus.BAD_REQUEST, 'Item does not belong to this auction');
  }
  return repo.deleteAuctionItem(userId, id);
}
