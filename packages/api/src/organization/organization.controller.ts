import type { RequestHandler } from "express";
import type { AddOrganizationMemberRequest, CreateOrganizationRequest } from "@auction/shared";
import { AppError, HttpStatus } from "../shared/errors/index.js";
import { getAuth, routeParam } from "../shared/types/request.js";
import { IdentityRepository } from "../identity/identity.repository.js";
import * as service from "./organization.service.js";

const identityRepo = new IdentityRepository();

/** Org admins may only manage their own organization; super admins, any. */
async function assertCanManage(
  auth: ReturnType<typeof getAuth>,
  organizationId: string,
): Promise<void> {
  if (auth.roles.includes("super_admin")) return;
  const isMember = await identityRepo.isMemberOf(auth.userId, organizationId);
  if (!isMember) {
    throw new AppError("Forbidden", HttpStatus.FORBIDDEN, "FORBIDDEN");
  }
}

export const create: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const org = await service.createOrganization(req.body as CreateOrganizationRequest, {
    userId: auth.userId,
    roles: auth.roles,
  });
  res.status(HttpStatus.CREATED).json(org);
};

export const getById: RequestHandler = async (req, res) => {
  res.json(await service.getOrganization(routeParam(req.params.id)));
};

export const list: RequestHandler = async (_req, res) => {
  res.json({ items: await service.listOrganizations() });
};

export const listMembers: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const organizationId = routeParam(req.params.id);
  await assertCanManage(auth, organizationId);
  res.json({ items: await service.listMembers(organizationId) });
};

export const addMember: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const organizationId = routeParam(req.params.id);
  await assertCanManage(auth, organizationId);
  const member = await service.addMember(organizationId, req.body as AddOrganizationMemberRequest, {
    userId: auth.userId,
    roles: auth.roles,
  });
  res.status(HttpStatus.CREATED).json(member);
};

export const removeMember: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const organizationId = routeParam(req.params.id);
  await assertCanManage(auth, organizationId);
  await service.removeMember(organizationId, routeParam(req.params.userId), {
    userId: auth.userId,
    roles: auth.roles,
  });
  res.status(HttpStatus.NO_CONTENT).send();
};
