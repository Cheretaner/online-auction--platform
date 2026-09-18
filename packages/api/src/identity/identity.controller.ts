import type { RequestHandler } from "express";
import type { LoginRequest, RegisterRequest } from "@auction/shared";
import * as service from "./identity.service.js";

export const register: RequestHandler = async (req, res, next) => {
  try {
    const body = req.body as RegisterRequest;
    const result = await service.register(body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const login: RequestHandler = async (req, res, next) => {
  try {
    const body = req.body as LoginRequest;
    const result = await service.login(body);
    res.json(result);
  } catch (error) {
    next(error);
  }
};
