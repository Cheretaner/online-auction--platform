import { Router } from "express";
import { requireAuth } from "../shared/middleware/auth.middleware.js";
import { asyncHandler } from "../shared/middleware/asyncHandler.js";
import { getAuth, routeParam } from "../shared/types/request.js";
import * as service from "./refund-letter.service.js";

export const refundLetterRouter = Router();
refundLetterRouter.get("/me", requireAuth(["bidder"]), asyncHandler(async (req, res) => {
  res.json({ items: await service.listMine(getAuth(req).userId) });
}));
refundLetterRouter.get("/:id", requireAuth(["bidder"]), asyncHandler(async (req, res) => {
  const letter = await service.getMine(routeParam(req.params.id), getAuth(req).userId);
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${letter.letterNumber}.txt"`);
  res.send(`${letter.letterNumber}\n\n${letter.body}\n\n${letter.officialStamp}`);
}));
