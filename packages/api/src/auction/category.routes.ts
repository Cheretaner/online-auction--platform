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

export const categoryRouter = Router();

const getCategories: RequestHandler = async (_req, res) => {
  res.json({ items: await repo.getCategories() });
};

const getCategory: RequestHandler = async (req, res) => {
  const category = await repo.getCategoryById(routeParam(req.params.id));
  if (!category) {
    throw new AppError("Category not found", HttpStatus.NOT_FOUND);
  }
  res.json(category);
};

const createCategory: RequestHandler = async (req, res) => {
  const category = await repo.createCategory(req.body as CreateCategoryBody);
  res.status(HttpStatus.CREATED).json(category);
};

const updateCategory: RequestHandler = async (req, res) => {
  const category = await repo.updateCategory(
    routeParam(req.params.id),
    req.body as Partial<CreateCategoryBody>,
  );
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
