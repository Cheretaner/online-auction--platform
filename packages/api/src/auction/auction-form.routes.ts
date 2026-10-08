import { Router } from "express";
import { z } from "zod";
import { query, queryAll } from "../infrastructure/database/query.js";
import { requireAuth } from "../shared/middleware/auth.middleware.js";
import { asyncHandler } from "../shared/middleware/asyncHandler.js";
import { getAuth, routeParam } from "../shared/types/request.js";
import { assertAuctionAccess } from "../shared/authz/auction-access.js";
import { auctionRequiresDocumentAccess, hasPaidDocumentAccess } from "../document/document-access.service.js";

const field = z.object({
  label: z.string().trim().min(1).max(200),
  fieldType: z.enum(["text", "number", "choice", "range"]),
  options: z.array(z.string().trim().min(1).max(200)).default([]),
  minValue: z.number().finite().optional(),
  maxValue: z.number().finite().optional(),
  required: z.boolean().default(true),
  position: z.number().int().min(0),
});

export const auctionFormRouter = Router({ mergeParams: true });

auctionFormRouter.get("/", requireAuth(), asyncHandler(async (req, res) => {
  const auth = getAuth(req);
  const auctionId = routeParam(req.params.auctionId);
  if (
    auth.roles.includes("bidder") &&
    await auctionRequiresDocumentAccess(auctionId) &&
    !(await hasPaidDocumentAccess(auctionId, auth.userId))
  ) {
    res.status(403).json({ error: { message: "Pay for the tender documents before viewing bid fields", code: "DOCUMENT_ACCESS_REQUIRED" } });
    return;
  }
  const rows = await queryAll(
    "SELECT id, label, field_type AS \"fieldType\", options, min_value AS \"minValue\", max_value AS \"maxValue\", required, position FROM auction_form_fields WHERE auction_id = $1 ORDER BY position",
    [auctionId],
  );
  res.json({ items: rows });
}));

auctionFormRouter.post("/", requireAuth(["auction_officer", "org_admin", "super_admin"]), asyncHandler(async (req, res) => {
  const auth = getAuth(req);
  const auctionId = routeParam(req.params.auctionId);
  await assertAuctionAccess(auctionId, { userId: auth.userId, roles: auth.roles, organizationId: auth.organizationId });
  const body = field.parse(req.body);
  const row = await query(
    `INSERT INTO auction_form_fields (auction_id, label, field_type, options, min_value, max_value, required, position)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, label, field_type AS "fieldType", options, min_value AS "minValue", max_value AS "maxValue", required, position`,
    [auctionId, body.label, body.fieldType, JSON.stringify(body.options), body.minValue ?? null, body.maxValue ?? null, body.required, body.position],
  );
  res.status(201).json(row.rows[0]);
}));
