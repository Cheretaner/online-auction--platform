import type { RequestHandler } from "express";
import type { AuthenticatedRequest } from "../shared/types/request.js";
import * as service from "./notification.service.js";

export const list: RequestHandler = async (req, res, next) => {
  try {
    const auth = (req as AuthenticatedRequest).auth!;
    const items = await service.listNotifications(auth.userId);
    res.json({ items });
  } catch (error) {
    next(error);
  }
};

export const send: RequestHandler = async (req, res, next) => {
  try {
    const { userId, email, channel, subject, body } = req.body as {
      userId: string;
      email?: string;
      channel: "email" | "in_app";
      subject: string;
      body: string;
    };
    const notification = await service.notifyUser({ userId, email, channel, subject, body });
    res.status(201).json(notification);
  } catch (error) {
    next(error);
  }
};
