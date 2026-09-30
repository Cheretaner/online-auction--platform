import { z } from "zod";
import { ITEM_CONDITIONS, CATEGORY_SOURCES } from "../enums.js";
import { Money } from "./money.js";

export const CreateAuctionItemRequest = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  quantity: z.number().int().positive().default(1),
  unit: z.string().max(30).optional(),
  condition: z.enum(ITEM_CONDITIONS).optional(),
  estimatedValue: Money.optional(),
  categoryId: z.string().uuid().optional(),
  categorySource: z.enum(CATEGORY_SOURCES).optional(),
  region: z.string().max(80).optional(),
  city: z.string().max(100).optional(),
});

export type CreateAuctionItemRequest = z.infer<typeof CreateAuctionItemRequest>;

export const UpdateAuctionItemRequest = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  quantity: z.number().int().positive().optional(),
  unit: z.string().max(30).optional(),
  condition: z.enum(ITEM_CONDITIONS).optional(),
  estimatedValue: Money.optional(),
  categoryId: z.string().uuid().optional(),
  categorySource: z.enum(CATEGORY_SOURCES).optional(),
  region: z.string().max(80).optional(),
  city: z.string().max(100).optional(),
});

export type UpdateAuctionItemRequest = z.infer<typeof UpdateAuctionItemRequest>;
