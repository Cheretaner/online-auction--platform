import type { RequestHandler } from "express";
import type { SendNotificationRequest } from "@auction/shared";
import { HttpStatus } from "../shared/errors/index.js";
import { getAuth, routeParam } from "../shared/types/request.js";
import * as service from "./notification.service.js";

export const list: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const unreadOnly = req.query.unread === "true";
  res.json({ items: await service.listNotifications(auth.userId, unreadOnly) });
};

export const unreadCount: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  res.json({ count: await service.countUnread(auth.userId) });
};

export const markRead: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  // Scoped by userId in the UPDATE, so one user cannot mark another's
  // notification as read.
  res.json(await service.markNotificationRead(routeParam(req.params.id), auth.userId));
};

export const markAllRead: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  res.json({ updated: await service.markAllRead(auth.userId) });
};

export const send: RequestHandler = async (req, res) => {
  const body = req.body as SendNotificationRequest;
  const notification = await service.enqueueNotification(body);
  res.status(HttpStatus.CREATED).json(notification);
};
