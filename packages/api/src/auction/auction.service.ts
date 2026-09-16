import type { CreateAuctionRequest } from "@auction/shared";
import { AppError, HttpStatus } from "../shared/errors/index.js";
import { assertTransition } from "./auction.stateMachine.js";
import * as repo from "./auction.repository.js";
import type { Auction } from "./auction.types.js";

export async function createAuction(
  input: CreateAuctionRequest & { createdBy: string },
): Promise<Auction> {
  return repo.createAuction(input);
}

export async function getAuction(id: string): Promise<Auction> {
  const auction = await repo.findAuctionById(id);
  if (!auction) throw new AppError("Auction not found", HttpStatus.NOT_FOUND);
  return auction;
}

export async function transitionAuction(id: string, toStatus: Auction["status"]): Promise<Auction> {
  const auction = await getAuction(id);
  assertTransition(auction.status, toStatus);
  return repo.updateAuctionStatus(id, toStatus);
}
