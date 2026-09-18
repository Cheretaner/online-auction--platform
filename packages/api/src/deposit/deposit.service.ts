import type { CreateDepositRequest } from "@auction/shared";
import * as repo from "./deposit.repository.js";
import type { Deposit } from "./deposit.types.js";

export async function createDeposit(
  userId: string,
  input: CreateDepositRequest,
): Promise<Deposit> {
  return repo.createDeposit({ userId, auctionId: input.auctionId, amount: input.amount });
}
