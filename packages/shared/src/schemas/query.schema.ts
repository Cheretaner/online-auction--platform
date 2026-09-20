import { z } from "zod";

/** Query-string shape for endpoints that list rows belonging to one auction. */
export const AuctionScopedQuery = z.object({
  auctionId: z.string().uuid(),
});
export type AuctionScopedQuery = z.infer<typeof AuctionScopedQuery>;

/** Query-string shape for endpoints where the auction filter is optional. */
export const OptionalAuctionScopedQuery = z.object({
  auctionId: z.string().uuid().optional(),
});
export type OptionalAuctionScopedQuery = z.infer<typeof OptionalAuctionScopedQuery>;
