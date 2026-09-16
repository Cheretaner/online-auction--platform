import type { RequestHandler } from "express";
import type { CreateDepositRequest } from "@auction/shared";
import type { AuthenticatedRequest } from "../shared/types/request.js";
import * as service from "./deposit.service.js";

export const create: RequestHandler = async (req, res, next) => {
  try {
    const auth = (req as AuthenticatedRequest).auth!;
    const body = req.body as CreateDepositRequest;
    const deposit = await service.createDeposit(auth.userId, body);
    res.status(201).json(deposit);
  } catch (error) {
    next(error);
  }
};
