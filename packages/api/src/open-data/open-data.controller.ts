import type { RequestHandler } from "express";
import * as service from "./open-data.service.js";

export const listAuctions: RequestHandler = async (req, res) => {
  const { limit, offset } = req.query as unknown as { limit: number; offset: number };
  res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=900");
  res.json(await service.listPublicAuctions(limit, offset));
};
