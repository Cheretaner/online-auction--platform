import type { RequestHandler } from "express";
import type {
  LoginRequest,
  RefreshTokenRequest,
  RegisterRequest,
  UpdateProfileRequest,
} from "@auction/shared";
import { AppError, HttpStatus } from "../shared/errors/index.js";
import { getAuth, routeParam } from "../shared/types/request.js";
import { IdentityService } from "./identity.service.js";

const service = new IdentityService();

export const register: RequestHandler = async (req, res) => {
  const session = await service.register(req.body as RegisterRequest);
  res.status(HttpStatus.CREATED).json(session);
};

export const login: RequestHandler = async (req, res) => {
  const session = await service.login(req.body as LoginRequest);
  res.json(session);
};

export const refresh: RequestHandler = async (req, res) => {
  const body = req.body as RefreshTokenRequest;
  const session = await service.refresh(body.refreshToken);
  res.json(session);
};

export const switchContext: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const organizationId = (req.body as { organizationId?: string }).organizationId;
  if (!organizationId) {
    throw AppError.badRequest("organizationId is required");
  }
  const session = await service.switchOrganization(auth.userId, organizationId);
  res.json(session);
};

export const getProfile: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  res.json(await service.getProfile(auth.userId));
};

export const updateProfile: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  res.json(await service.updateProfile(auth.userId, req.body as UpdateProfileRequest));
};

export const getProfileById: RequestHandler = async (req, res) => {
  res.json(await service.getProfile(routeParam(req.params.id)));
};
