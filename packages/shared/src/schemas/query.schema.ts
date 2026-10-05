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

/** Statuses the public catalogue can be filtered by. */
export const PUBLIC_AUCTION_FILTER_STATUSES = ["scheduled", "live", "closed", "under_review", "awarded"] as const;

/** Query-string shape for the public auction catalogue (GET /auctions). */
export const PublicAuctionListQuery = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  status: z.enum(PUBLIC_AUCTION_FILTER_STATUSES).optional(),
  categoryId: z.string().uuid().optional(),
  orgId: z.string().uuid().optional(),
  region: z.string().trim().min(1).max(80).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(24),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
  /**
   * When true, the full-text search in `q` also scans OCR-extracted text
   * from documents attached to each auction.  Off by default so standard
   * catalogue requests stay fast.
   */
  includeDocumentSearch: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true")
    .optional(),
});
export type PublicAuctionListQuery = z.infer<typeof PublicAuctionListQuery>;
