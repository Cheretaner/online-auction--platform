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
  opensAt: z.preprocess((val) => {
    if (typeof val === 'string' && val.trim() !== '') {
      // Replace slashes with dashes and parse cleanly
      return new Date(val);
    }
    return val;
  }, z.date({ message: "Invalid datetime" })),

  closesAt: z.preprocess((val) => {
    if (typeof val === 'string' && val.trim() !== '') {
      return new Date(val);
    }
    return val;
  }, z.date({ message: "Invalid datetime" })),
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

export const TransitionAuctionRequest = z.object({
  status: z.enum(AUCTION_STATUS),
});
export type TransitionAuctionRequest = z.infer<typeof TransitionAuctionRequest>;

export const CancelAuctionRequest = z.object({
  reason: z.string().min(4).max(2000).optional(),
});
export type CancelAuctionRequest = z.infer<typeof CancelAuctionRequest>;

export const ListAuctionsQuery = z.object({
  q: z.string().optional(),
  status: z.string().optional(),
  region: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});
export type ListAuctionsQuery = z.infer<typeof ListAuctionsQuery>;
