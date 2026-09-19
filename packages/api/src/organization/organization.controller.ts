import type { RequestHandler } from "express";
import type { CreateOrganizationRequest } from "@auction/shared";
import type { AuthenticatedRequest } from "../shared/types/request.js";
import { routeParam } from "../shared/types/request.js";
import * as service from "./organization.service.js";

export const create: RequestHandler = async (req, res, next) => {
  try {
    const auth = (req as AuthenticatedRequest).auth!;
    const body = req.body as CreateOrganizationRequest;
    const org = await service.createOrganization(body, auth.userId);
    res.status(201).json(org);
  } catch (error) {
    next(error);
  }
};

export const getById: RequestHandler = async (req, res, next) => {
  try {
    const org = await service.getOrganization(routeParam(req.params.id));
    res.json(org);
  } catch (error) {
    next(error);
  }
};

export const list: RequestHandler = async (_req, res, next) => {
  try {
    const orgs = await service.listOrganizations();
    res.json({ items: orgs });
  } catch (error) {
    next(error);
  }
};
