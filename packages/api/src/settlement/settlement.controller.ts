import type { RequestHandler } from "express";
import { HttpStatus } from "../shared/errors/index.js";
import { getAuth, routeParam } from "../shared/types/request.js";
import * as paymentService from "../payments/payment.service.js";

export const listMine: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  res.json({ items: await paymentService.listMySettlements(auth.userId) });
};

export const initiate: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  const result = await paymentService.initiateChapaSettlement(
    { userId: auth.userId, roles: auth.roles },
    routeParam(req.params.auctionId),
  );
  res.status(result.checkoutUrl ? HttpStatus.CREATED : HttpStatus.OK).json(result);
};