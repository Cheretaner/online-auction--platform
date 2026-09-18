import type { RequestHandler } from "express";
import type { AssistRequest, CategorizeRequest, ReviewAnomalyRequest } from "@auction/shared";
import { getAuth, routeParam } from "../shared/types/request.js";
import * as anomalyService from "./anomaly.service.js";
import * as assistantService from "./assistant.service.js";
import * as categorizationService from "./categorization.service.js";

export const categorize: RequestHandler = async (req, res) => {
  const body = req.body as CategorizeRequest;
  const result = await categorizationService.categorizeText(body.text, body.itemId);
  res.json(result);
};

export const detectAnomaly: RequestHandler = async (req, res) => {
  const auctionId = typeof req.body?.auctionId === "string" ? req.body.auctionId : undefined;
  if (!auctionId) {
    res.status(400).json({ error: { message: "auctionId is required" } });
    return;
  }
  const flag = await anomalyService.evaluateAuction(auctionId);
  res.json({ flagged: Boolean(flag), flag });
};

export const listAnomalies: RequestHandler = async (req, res) => {
  const auctionId = typeof req.query.auctionId === "string" ? req.query.auctionId : undefined;
  const items = await anomalyService.listAnomalies(auctionId);
  res.json({ items });
};

export const reviewAnomaly: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const body = req.body as ReviewAnomalyRequest;
  const flag = await anomalyService.reviewAnomaly({
    id: routeParam(req.params.id),
    reviewerId: auth.userId,
    status: body.status,
    decisionNote: body.decisionNote,
  });
  res.json(flag);
};

export const assist: RequestHandler = async (req, res) => {
  const body = req.body as AssistRequest;
  const result = await assistantService.askAssistant(body.prompt, body.auctionId);
  res.json(result);
};
