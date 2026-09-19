import { z } from "zod";

export const CreateCategoryRequest = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  parentId: z.string().uuid().optional(),
  description: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
});

export type CreateCategoryRequest = z.infer<typeof CreateCategoryRequest>;

export const CategoryResponse = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  parentId: z.string().uuid().nullable(),
  description: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type CategoryResponse = z.infer<typeof CategoryResponse>;
