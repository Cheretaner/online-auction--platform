import { z } from "zod";
import { Money } from "./money.js";

export const CreateDepositRequest = z.object({
  auctionId: z.string().uuid(),
  amount: Money,
});

export type CreateDepositRequest = z.infer<typeof CreateDepositRequest>;
