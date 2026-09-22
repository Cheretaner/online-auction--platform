import { Router } from "express";
import type { RequestHandler } from "express";
import { CreateCategoryRequest } from "@auction/shared";
import { requireAuth } from "../shared/middleware/auth.middleware.js";
import { asyncHandler } from "../shared/middleware/asyncHandler.js";
import { validate } from "../shared/middleware/validate.middleware.js";
import { AppError, HttpStatus } from "../shared/errors/index.js";
import { routeParam } from "../shared/types/request.js";
import * as repo from "./category.repository.js";
import type { CreateCategoryRequest as CreateCategoryBody } from "@auction/shared";

import { cacheService } from "../infrastructure/cache/cache.service.js";

export const categoryRouter = Router();

const getCategories: RequestHandler = async (_req, res) => {
  const items = await cacheService.getOrSet(
    "categories:all",
    300,
    () => repo.getCategories(),
    ["categories"],
  );
  res.json({ items });
};

const getCategory: RequestHandler = async (req, res) => {
  const id = routeParam(req.params.id);
  const category = await cacheService.getOrSet(
    `categories:${id}`,
    300,
    () => repo.getCategoryById(id),
    ["categories"],
  );
  if (!category) {
    throw new AppError("Category not found", HttpStatus.NOT_FOUND);
  }
  res.json(category);
};

const createCategory: RequestHandler = async (req, res) => {
  const category = await repo.createCategory(req.body as CreateCategoryBody);
  cacheService.invalidateTag("categories");
  res.status(HttpStatus.CREATED).json(category);
};

const updateCategory: RequestHandler = async (req, res) => {
  const category = await repo.updateCategory(
    routeParam(req.params.id),
    req.body as Partial<CreateCategoryBody>,
  );
  cacheService.invalidateTag("categories");
  res.json(category);
};

// The taxonomy is public: it drives search facets and AI categorisation.
categoryRouter.get("/", asyncHandler(getCategories));
categoryRouter.get("/:id", asyncHandler(getCategory));

// Mutations are platform-level. Previously this used `categoryRouter.use(requireAuth)`
// with the un-invoked factory, which hung every request that reached it.
categoryRouter.post(
  "/",
  requireAuth(["super_admin"]),
  validate(CreateCategoryRequest),
  asyncHandler(createCategory),
);

categoryRouter.patch(
  "/:id",
  requireAuth(["super_admin"]),
  validate(CreateCategoryRequest.partial()),
  asyncHandler(updateCategory),
);
