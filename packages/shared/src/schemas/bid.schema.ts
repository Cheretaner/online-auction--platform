import { z } from "zod";
import { Money } from "./money.js";

export const PlaceBidRequest = z.object({ amount: Money });
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
