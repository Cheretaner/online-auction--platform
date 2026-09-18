import type { RequestHandler } from "express";
import type { SendNotificationRequest } from "@auction/shared";
import { getAuth, routeParam } from "../shared/types/request.js";
import * as service from "./notification.service.js";

export const list: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const unreadOnly = req.query.unread === "true";
  const items = await service.listNotifications(auth.userId, unreadOnly);
  res.json({ items });
};

export const markRead: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const notification = await service.markNotificationRead(routeParam(req.params.id), auth.userId);
  res.json(notification);
};

export const send: RequestHandler = async (req, res) => {
  const body = req.body as SendNotificationRequest;
  const notification = await service.enqueueNotification({
    userId: body.userId,
    channel: body.channel,
    type: body.type,
    title: body.title,
    message: body.message,
    relatedEntityType: body.relatedEntityType,
    relatedEntityId: body.relatedEntityId,
  });
  res.status(201).json(notification);
};
