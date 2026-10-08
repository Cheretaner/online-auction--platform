import type { RequestHandler } from "express";
import type {
  CreateUserRequest,
  LoginRequest,
  PasswordResetConfirm,
  PasswordResetRequest,
  RefreshTokenRequest,
  RegisterRequest,
  UpdateProfileRequest,
  UpdateUserRequest,
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

export const requestPasswordReset: RequestHandler = async (req, res) => {
  const body = req.body as PasswordResetRequest;
  await service.requestPasswordReset(body.email);
  res.status(202).json({ message: "If that address has an account, a reset link is on its way." });
};

export const confirmPasswordReset: RequestHandler = async (req, res) => {
  const body = req.body as PasswordResetConfirm;
  await service.confirmPasswordReset(body.token, body.password);
  res.status(204).end();
};

export const logout: RequestHandler = async (req, res) => {
  const body = req.body as RefreshTokenRequest;
  await service.logout(body.refreshToken);
  res.status(204).end();
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

export const listUsers: RequestHandler = async (_req, res) => {
  res.json({ items: await service.listUsers() });
};

export const createUser: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  res.status(HttpStatus.CREATED).json(await service.createUser(req.body as CreateUserRequest, {
    userId: auth.userId,
    roles: auth.roles,
  }));
};

export const updateUser: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  res.json(await service.updateUser(routeParam(req.params.id), req.body as UpdateUserRequest, {
    userId: auth.userId,
    roles: auth.roles,
  }));
};

export const deleteUser: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  await service.deactivateUser(routeParam(req.params.id), {
    userId: auth.userId,
    roles: auth.roles,
  });
  res.status(HttpStatus.NO_CONTENT).send();
};
