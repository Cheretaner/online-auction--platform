import type { RequestHandler } from "express";
import type {
  AssistRequest,
  CategorizeRequest,
  DetectAnomalyRequest,
  OptionalAuctionScopedQuery,
  ReviewAnomalyRequest,
} from "@auction/shared";
import { getAuth, routeParam } from "../shared/types/request.js";
import { assertAuctionAccess } from "../shared/authz/auction-access.js";
import * as anomalyService from "./anomaly.service.js";
import * as assistantService from "./assistant.service.js";
import * as categorizationService from "./categorization.service.js";
import { AppError, HttpStatus } from "../shared/errors/index.js";

export const categorize: RequestHandler = async (req, res) => {
  const body = req.body as CategorizeRequest;
  if (body.itemId) {
    const auctionId = await categorizationService.getItemAuctionId(body.itemId);
    if (!auctionId) {
      throw new AppError("Auction item not found", HttpStatus.NOT_FOUND);
    }
    await assertAuctionAccess(auctionId, actorOf(getAuth(req)));
  }
  const result = await categorizationService.categorizeText(body.text, body.itemId);
  res.json(result);
};

export const detectAnomaly: RequestHandler = async (req, res) => {
  const { auctionId } = req.body as DetectAnomalyRequest;
  await assertAuctionAccess(auctionId, actorOf(getAuth(req)));
  const { flag, advisory } = await anomalyService.assessAuction(auctionId);
  res.json({ flagged: Boolean(flag) || Boolean(advisory?.flagged), flag, advisory });
};

function actorOf(auth: ReturnType<typeof getAuth>) {
  return { userId: auth.userId, roles: auth.roles, organizationId: auth.organizationId };
}

export const listAnomalies: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const { auctionId } = req.query as unknown as OptionalAuctionScopedQuery;
  // Flags name accounts under suspicion, so officers see their own
  // organization's flags only; super admins see everything.
  if (auctionId) {
    await assertAuctionAccess(auctionId, actorOf(auth));
    res.json({ items: await anomalyService.listAnomalies({ auctionId }) });
    return;
  }
  if (auth.roles.includes("super_admin")) {
    res.json({ items: await anomalyService.listAnomalies({}) });
    return;
  }
  if (!auth.organizationId) {
    res.json({ items: [] });
    return;
  }
  res.json({ items: await anomalyService.listAnomalies({ orgId: auth.organizationId }) });
};

export const reviewAnomaly: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const body = req.body as ReviewAnomalyRequest;
  const id = routeParam(req.params.id);
  const existing = await anomalyService.getAnomaly(id);
  await assertAuctionAccess(existing.auctionId, actorOf(auth));
  const flag = await anomalyService.reviewAnomaly({
    id,
    reviewerId: auth.userId,
    roles: auth.roles,
    status: body.status,
    decisionNote: body.decisionNote,
  });
  res.json(flag);
};

export const getAnomaly: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const flag = await anomalyService.getAnomaly(routeParam(req.params.id));
  await assertAuctionAccess(flag.auctionId, actorOf(auth));
  res.json(flag);
};

export const assist: RequestHandler = async (req, res) => {
  const body = req.body as AssistRequest;
  if (body.auctionId) await assertAuctionAccess(body.auctionId, actorOf(getAuth(req)));
  const result = await assistantService.askAssistant(body.prompt, body.auctionId, body.language);
  res.json(result);
};

/**
 * GET /api/v1/ai/anomalies/:id/context
 * Get historical context for an anomaly flag
 * Shows similar past flags, bidder risk profiles, and rule outcome statistics
 */
export const getAnomalyContext: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const id = routeParam(req.params.id);
  
  const context = await anomalyService.getAnomalyHistoricalContext(id, actorOf(auth));
  
  res.json(context);
};

/**
 * GET /api/v1/ai/organizations/:orgId/compliance-patterns
 * Get compliance patterns and historical flag trends for an organization
 */
export const getOrgCompliancePatterns: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const orgId = routeParam(req.params.orgId);
  
  const patterns = await anomalyService.getOrgCompliancePatterns(orgId, actorOf(auth));
  
  res.json(patterns);
};
