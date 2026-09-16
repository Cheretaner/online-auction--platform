import { z } from "zod";
import { AUCTION_STATUS } from "../enums.js";
import { Money } from "./money.js";

export const CreateAuctionRequest = z.object({
  organizationId: z.string().uuid(),
  title: z.string().min(3).max(200),
  description: z.string().max(5000).optional(),
  startingPrice: Money,
  opensAt: z.string().datetime().optional(),
  closesAt: z.string().datetime().optional(),
});

export type CreateAuctionRequest = z.infer<typeof CreateAuctionRequest>;

export const AuctionStatusSchema = z.enum(AUCTION_STATUS);
