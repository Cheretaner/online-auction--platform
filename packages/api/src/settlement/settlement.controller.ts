import type { RequestHandler } from "express";
import { getAuth } from "../shared/types/request.js";
import * as paymentService from "../payments/payment.service.js";

export const listMine: RequestHandler = async (req, res) => {
  const auth = getAuth(req);
  res.json({ items: await paymentService.listMySettlements(auth.userId) });
};
