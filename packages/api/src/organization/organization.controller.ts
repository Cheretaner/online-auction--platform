import type { RequestHandler } from "express";
import * as service from "./organization.service.js";

export const create: RequestHandler = async (req, res, next) => {
  try {
    const { name, slug } = req.body as { name: string; slug: string };
    const org = await service.createOrganization(name, slug);
    res.status(201).json(org);
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
