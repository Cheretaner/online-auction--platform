import type { RequestHandler } from "express";
import * as service from "./open-data.service.js";

export const listAuctions: RequestHandler = async (req, res) => {
  const limitValue = Number(req.query.limit ?? 100);
  const offsetValue = Number(req.query.offset ?? 0);
  const limit = Number.isInteger(limitValue) ? Math.min(Math.max(limitValue, 1), 500) : 100;
  const offset = Number.isInteger(offsetValue) ? Math.max(offsetValue, 0) : 0;
  res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=900");
  res.json(await service.listPublicAuctions(limit, offset));
};

export const weeklyCsv: RequestHandler = async (_req, res) => {
  const { start, end } = service.previousWeek();
  const records = await service.listFinalizedBetween(start, end);
  const weekLabel = start.toISOString().slice(0, 10);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="cheretanet-auctions-week-of-${weekLabel}.csv"`);
  res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
  res.setHeader("X-Export-Period-Start", start.toISOString());
  res.setHeader("X-Export-Period-End", end.toISOString());
  res.send(`\uFEFF${service.toCsv(records)}\r\n`);
};
