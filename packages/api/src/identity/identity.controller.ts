import type { Request, Response, NextFunction, RequestHandler } from "express";
import { IdentityService } from "./identity.service.js";
import { getAuth } from "../shared/types/request.js";

const service = new IdentityService();

export const register: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await service.register(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const login: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await service.login(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getProfile: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auth = getAuth(req);
    const result = await service.getProfile(auth.userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const updateProfile: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auth = getAuth(req);
    const result = await service.updateProfile(auth.userId, req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
};
