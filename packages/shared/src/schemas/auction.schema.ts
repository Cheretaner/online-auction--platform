import { z } from "zod";
import { AUCTION_STATUS, AUCTION_TYPES } from "../enums.js";
import { Money } from "./money.js";

export const CreateAuctionRequest = z.object({
  organizationId: z.string().uuid(),
  title: z.string().min(3).max(200),
  description: z.string().max(5000).optional(),
  auctionType: z.enum(AUCTION_TYPES),
  startPrice: Money,
  reservePrice: Money.optional(),
  minIncrement: Money,
  depositAmount: Money.default("0.00"),
  eligibilityRules: z.string().max(2000).optional(),
  region: z.string().max(80).optional(),
  opensAt: z.string().datetime(),
  closesAt: z.string().datetime(),
});

export type CreateAuctionRequest = z.infer<typeof CreateAuctionRequest>;

export const UpdateAuctionRequest = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().max(5000).optional(),
  startPrice: Money.optional(),
  reservePrice: Money.optional(),
  minIncrement: Money.optional(),
  depositAmount: Money.optional(),
  eligibilityRules: z.string().max(2000).optional(),
  region: z.string().max(80).optional(),
  opensAt: z.string().datetime().optional(),
  closesAt: z.string().datetime().optional(),
});

export type UpdateAuctionRequest = z.infer<typeof UpdateAuctionRequest>;

export const AuctionStatusSchema = z.enum(AUCTION_STATUS);
