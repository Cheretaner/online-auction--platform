import type { RequestHandler } from "express";
import type { ReviewVerificationRequest, SubmitVerificationRequest } from "@auction/shared";
import { HttpStatus } from "../shared/errors/index.js";
import { getAuth, routeParam } from "../shared/types/request.js";
import { VerificationService } from "./verification.service.js";

const service = new VerificationService();

export const submitVerification: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const result = await service.submit(auth.userId, req.body as SubmitVerificationRequest);
  res.status(HttpStatus.CREATED).json(result);
};

export const reviewVerification: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const result = await service.review(
    { userId: auth.userId, roles: auth.roles },
    routeParam(req.params.id),
    req.body as ReviewVerificationRequest,
  );
  res.json(result);
};

export const listPending: RequestHandler = async (_req, res) => {
  res.json({ items: await service.listPending() });
};

export const getMyVerification: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  res.json(await service.getLatestFor(auth.userId));
};

export const checkDuplicates: RequestHandler = async (req, res) => {
  res.json(await service.checkDuplicates(routeParam(req.params.userId)));
};
