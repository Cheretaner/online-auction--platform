import { z } from "zod";
import { AUCTION_STATUS, AUCTION_TYPE } from "../enums.js";
import { Money } from "./money.js";

export const CreateAuctionRequest = z.object({
  organizationId: z.string().uuid(),
  title: z.string().min(3).max(200),
  description: z.string().max(5000).optional(),
  auctionType: z.enum(AUCTION_TYPE),
  startingPrice: Money,
  reservePrice: Money.optional(),
  minIncrement: Money,
  depositAmount: Money.default("0.00"),
  opensAt: z.string().datetime(),
  closesAt: z.string().datetime(),
  antiSnipeSeconds: z.number().int().min(0).max(3600).default(120),
  maxExtensions: z.number().int().min(0).max(50).default(5),
});

export type CreateAuctionRequest = z.infer<typeof CreateAuctionRequest>;

export const AuctionStatusSchema = z.enum(AUCTION_STATUS);
