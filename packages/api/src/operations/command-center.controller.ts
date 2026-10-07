import type { RequestHandler } from "express";
import { getAuth } from "../shared/types/request.js";
import { AppError, HttpStatus } from "../shared/errors/index.js";
import { listExceptions } from "./command-center.repository.js";
import { prioritizeExceptions } from "./command-center.service.js";

export const listCommandCenterExceptions: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const organizationId = auth.roles.includes("super_admin") ? undefined : auth.organizationId;
  if (!organizationId && !auth.roles.includes("super_admin")) {
    throw new AppError("Organization context required", HttpStatus.FORBIDDEN, "ORG_CONTEXT_REQUIRED");
  }
  const items = await listExceptions(organizationId);
  res.json({ items: prioritizeExceptions(items) });
};
