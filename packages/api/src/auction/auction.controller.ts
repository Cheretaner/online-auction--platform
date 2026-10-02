import type { RequestHandler } from "express";
import type {
  PublicAuctionListQuery,
  CancelAuctionRequest,
  CreateAuctionRequest,
  TransitionAuctionRequest,
  UpdateAuctionRequest,
} from "@auction/shared";
import { AppError, HttpStatus } from "../shared/errors/index.js";
import { getAuth, routeParam } from "../shared/types/request.js";
import type { AuthContext, AuthenticatedRequest } from "../shared/types/request.js";
import * as AuctionService from "./auction.service.js";


function orgContext(auth: AuthContext): { orgId: string; actor: AuctionService.AuctionActor } {
  if (!auth.organizationId) {
    throw new AppError(
      "Organization context required",
      HttpStatus.FORBIDDEN,
      "ORG_CONTEXT_REQUIRED",
    );
  }
  return {
    orgId: auth.organizationId,
    actor: { userId: auth.userId, roles: auth.roles, organizationId: auth.organizationId },
  };
}

export const create: RequestHandler = async (req, res) => {
  const { orgId, actor } = orgContext(getAuth(req));
  const body = req.body as CreateAuctionRequest;

  // The organization is taken from the authenticated context, never from the
  // request body, so a member of one org cannot create auctions for another.
  if (body.organizationId && body.organizationId !== orgId) {
    throw new AppError(
      "You cannot create an auction for another organization",
      HttpStatus.FORBIDDEN,
      "FORBIDDEN",
    );
  }

  const auction = await AuctionService.createAuction(orgId, actor, body);
  res.status(HttpStatus.CREATED).json(auction);
};

export const getById: RequestHandler = async (req, res) => {
  res.json(await AuctionService.getAuction(routeParam(req.params.id), (req as AuthenticatedRequest).auth));
};

export const listPublic: RequestHandler = async (req, res) => {
  const filters = req.query as unknown as PublicAuctionListQuery;
  const page = await AuctionService.listPublicAuctions({
    ...filters,
    includeDocumentSearch: filters.includeDocumentSearch === true,
  });
  res.json({ items: page.items, total: page.total, limit: filters.limit, offset: filters.offset });
};

export const listByOrg: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const orgId = routeParam(req.params.orgId);
  if (auth.organizationId !== orgId && !auth.roles.includes("super_admin")) {
    throw new AppError("Forbidden", HttpStatus.FORBIDDEN, "FORBIDDEN");
  }
  const items = await AuctionService.listByOrg(orgId);
  res.json({ items });
};

export const submitForApproval: RequestHandler = async (req, res) => {
  const { orgId, actor } = orgContext(getAuth(req));
  res.json(await AuctionService.submitForApproval(routeParam(req.params.id), orgId, actor));
};

export const approve: RequestHandler = async (req, res) => {
  const { orgId, actor } = orgContext(getAuth(req));
  res.json(await AuctionService.approveAuction(routeParam(req.params.id), orgId, actor));
};

export const transition: RequestHandler = async (req, res) => {
  const { orgId, actor } = orgContext(getAuth(req));
  const body = req.body as TransitionAuctionRequest;
  res.json(await AuctionService.transitionAuction(routeParam(req.params.id), orgId, body.status, actor));
};

export const amend: RequestHandler = async (req, res) => {
  const { orgId, actor } = orgContext(getAuth(req));
  const body = req.body as UpdateAuctionRequest;
  res.json(await AuctionService.amendAuction(routeParam(req.params.id), orgId, body, actor));
};

export const cancel: RequestHandler = async (req, res) => {
  const { orgId, actor } = orgContext(getAuth(req));
  const body = (req.body ?? {}) as CancelAuctionRequest;
  res.json(await AuctionService.cancelAuction(routeParam(req.params.id), orgId, actor, body.reason));
};
