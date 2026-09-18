import { z } from "zod";
import { Money } from "./money.js";

export const PlaceBidRequest = z.object({
  amount: Money,
  commitmentHash: z
    .string()
    .regex(/^[a-fA-F0-9]{64}$/, "commitment hash must be sha256 hex")
    .optional(),
});
export type PlaceBidRequest = z.infer<typeof PlaceBidRequest>;

export const PlaceBidResponse = z.object({
  bidId: z.string().uuid(),
  amount: Money,
  placedAt: z.string().datetime(),
  auction: z.object({
    currentHighestBid: Money,
    bidCount: z.number().int(),
    closesAt: z.string().datetime(),
    extended: z.boolean(),
  }),
  audit: z.object({
    eventId: z.string().uuid(),
    sequenceNo: z.number().int(),
    hash: z.string().length(64),
  }),
});
export type PlaceBidResponse = z.infer<typeof PlaceBidResponse>;

export const WithdrawBidRequest = z.object({
  reason: z.string().min(8).max(2000),
});
export type WithdrawBidRequest = z.infer<typeof WithdrawBidRequest>;
