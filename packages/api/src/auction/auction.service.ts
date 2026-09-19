import { withTransaction } from "../infrastructure/database/tx.js";
import { AppError, HttpStatus } from "../shared/errors/index.js";
import type { Auction } from "./auction.types.js";
import * as AuctionRepo from "./auction.repository.js";
import { canTransition } from "./auction.stateMachine.js";
import type { AuctionStatus } from "@auction/shared";
import type { CreateAuctionRequest, UpdateAuctionRequest } from "@auction/shared";

export async function createAuction(orgId: string, userId: string, data: CreateAuctionRequest): Promise<Auction> {
  if (new Date(data.closesAt) <= new Date(data.opensAt)) {
    throw new AppError("closesAt must be after opensAt", HttpStatus.BAD_REQUEST);
  }
  return withTransaction(async (client) => {
    return AuctionRepo.createAuction(orgId, userId, data, client);
  });
}

export async function getAuction(id: string): Promise<Auction> {
  const auction = await AuctionRepo.findById(id);
  if (!auction) {
    throw new AppError("Auction not found", HttpStatus.NOT_FOUND);
  }
  return auction;
}

export async function listPublicAuctions(): Promise<Auction[]> {
  return AuctionRepo.listPublicAuctions();
}

export async function listByOrg(orgId: string): Promise<Auction[]> {
  return AuctionRepo.listByOrgId(orgId);
}

export async function submitForApproval(id: string, orgId: string, userId: string): Promise<Auction> {
  return withTransaction(async (client) => {
    const auction = await AuctionRepo.findById(id, client);
    if (!auction) throw new AppError("Auction not found", HttpStatus.NOT_FOUND);
    if (auction.orgId !== orgId) throw new AppError("Forbidden", HttpStatus.FORBIDDEN);
    
    if (!canTransition(auction.status, "pending_review")) {
      throw new AppError(`Cannot transition from ${auction.status} to pending_review`, HttpStatus.BAD_REQUEST);
    }
    return AuctionRepo.updateStatus(id, "pending_review", null, client);
  });
}

export async function approveAuction(id: string, orgId: string, userId: string): Promise<Auction> {
  return withTransaction(async (client) => {
    const auction = await AuctionRepo.findById(id, client);
    if (!auction) throw new AppError("Auction not found", HttpStatus.NOT_FOUND);
    if (auction.orgId !== orgId) throw new AppError("Forbidden", HttpStatus.FORBIDDEN);
    
    if (auction.createdBy === userId) {
      throw new AppError("Two-person rule: cannot approve your own auction", HttpStatus.BAD_REQUEST);
    }
    
    if (!canTransition(auction.status, "scheduled")) {
      throw new AppError(`Cannot transition from ${auction.status} to scheduled`, HttpStatus.BAD_REQUEST);
    }
    return AuctionRepo.updateStatus(id, "scheduled", userId, client);
  });
}

export async function transitionAuction(id: string, orgId: string, status: AuctionStatus): Promise<Auction> {
  return withTransaction(async (client) => {
    const auction = await AuctionRepo.findById(id, client);
    if (!auction) throw new AppError("Auction not found", HttpStatus.NOT_FOUND);
    if (auction.orgId !== orgId) throw new AppError("Forbidden", HttpStatus.FORBIDDEN);
    
    if (!canTransition(auction.status, status)) {
      throw new AppError(`Cannot transition from ${auction.status} to ${status}`, HttpStatus.BAD_REQUEST);
    }
    return AuctionRepo.updateStatus(id, status, undefined, client);
  });
}

export async function amendAuction(id: string, orgId: string, data: UpdateAuctionRequest): Promise<Auction> {
  return withTransaction(async (client) => {
    const auction = await AuctionRepo.findById(id, client);
    if (!auction) throw new AppError("Auction not found", HttpStatus.NOT_FOUND);
    if (auction.orgId !== orgId) throw new AppError("Forbidden", HttpStatus.FORBIDDEN);
    
    if (auction.status !== "draft") {
      throw new AppError("Only draft auctions can be amended", HttpStatus.BAD_REQUEST);
    }
    
    if (data.closesAt && data.opensAt) {
      if (new Date(data.closesAt) <= new Date(data.opensAt)) {
        throw new AppError("closesAt must be after opensAt", HttpStatus.BAD_REQUEST);
      }
    } else if (data.closesAt) {
      if (new Date(data.closesAt) <= new Date(auction.opensAt)) {
         throw new AppError("closesAt must be after opensAt", HttpStatus.BAD_REQUEST);
      }
    } else if (data.opensAt) {
      if (new Date(auction.closesAt) <= new Date(data.opensAt)) {
         throw new AppError("closesAt must be after opensAt", HttpStatus.BAD_REQUEST);
      }
    }

    return AuctionRepo.updateAuction(id, data, client);
  });
}

export async function cancelAuction(id: string, orgId: string): Promise<Auction> {
  return withTransaction(async (client) => {
    const auction = await AuctionRepo.findById(id, client);
    if (!auction) throw new AppError("Auction not found", HttpStatus.NOT_FOUND);
    if (auction.orgId !== orgId) throw new AppError("Forbidden", HttpStatus.FORBIDDEN);
    
    if (!canTransition(auction.status, "cancelled")) {
      throw new AppError(`Cannot cancel auction in status ${auction.status}`, HttpStatus.BAD_REQUEST);
    }
    return AuctionRepo.updateStatus(id, "cancelled", undefined, client);
  });
}
