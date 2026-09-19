import type { Request, Response, NextFunction, RequestHandler } from "express";
import { VerificationService } from "./verification.service.js";
import { getAuth, routeParam } from "../shared/types/request.js";

const service = new VerificationService();

export const submitVerification: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auth = getAuth(req);
    const result = await service.submit(auth.userId, req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const reviewVerification: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auth = getAuth(req);
    const verificationId = routeParam(req.params.id);
    const result = await service.review(auth.userId, verificationId, req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const listPending: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await service.listPending();
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const checkDuplicates: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = routeParam(req.params.userId);
    const result = await service.checkDuplicates(userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
};
