import { Router } from "express";
import type { RequestHandler } from "express";
import { requireAuth } from "../shared/middleware/auth.middleware.js";
import { AppError, HttpStatus } from "../shared/errors/index.js";
import { getAuth, routeParam } from "../shared/types/request.js";
import * as repo from "./category.repository.js";
import type { CreateCategoryRequest } from "@auction/shared";

export const categoryRouter = Router();

const requireSuperAdmin: RequestHandler = (req, res, next) => {
  const auth = getAuth(req);
  if (!auth.roles.includes('super_admin')) {
    return next(new AppError('Super admin access required', HttpStatus.FORBIDDEN));
  }
  next();
};

const getCategories: RequestHandler = async (req, res, next) => {
  try {
    const categories = await repo.getCategories();
    res.status(HttpStatus.OK).json(categories);
  } catch (error) {
    next(error);
  }
};

const getCategory: RequestHandler = async (req, res, next) => {
  try {
    const id = routeParam(req.params.id);
    const category = await repo.getCategoryById(id);
    if (!category) {
      throw new AppError('Category not found', HttpStatus.NOT_FOUND);
    }
    res.status(HttpStatus.OK).json(category);
  } catch (error) {
    next(error);
  }
};

const createCategory: RequestHandler = async (req, res, next) => {
  try {
    const data = req.body as CreateCategoryRequest;
    const category = await repo.createCategory(data);
    res.status(HttpStatus.CREATED).json(category);
  } catch (error) {
    next(error);
  }
};

const updateCategory: RequestHandler = async (req, res, next) => {
  try {
    const id = routeParam(req.params.id);
    const data = req.body as Partial<CreateCategoryRequest>;
    const category = await repo.updateCategory(id, data);
    res.status(HttpStatus.OK).json(category);
  } catch (error) {
    next(error);
  }
};

// Public routes
categoryRouter.get("/", getCategories);
categoryRouter.get("/:id", getCategory);

// Protected routes (super_admin only)
categoryRouter.use(requireAuth);
categoryRouter.use(requireSuperAdmin);
categoryRouter.post("/", createCategory);
categoryRouter.patch("/:id", updateCategory);
