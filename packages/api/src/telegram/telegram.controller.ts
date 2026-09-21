import type { Request, Response } from "express";
import { getAuth } from "../shared/types/request.js";
import { HttpStatus } from "../shared/errors/index.js";
import { telegramService } from "./telegram.service.js";

export async function handleWebhook(req: Request, res: Response): Promise<void> {
  const secretHeader = req.headers["x-telegram-bot-api-secret-token"] as string | undefined;

  try {
    await telegramService.handleWebhookUpdate(req.body, secretHeader);
    res.status(HttpStatus.OK).json({ ok: true });
  } catch (error: any) {
    res.status(HttpStatus.BAD_REQUEST).json({
      error: { message: error.message || "Webhook processing failed", code: "TELEGRAM_WEBHOOK_ERROR" },
    });
  }
}

export async function createLinkToken(req: Request, res: Response): Promise<void> {
  const auth = getAuth(req);
  const result = await telegramService.createLinkToken(auth.userId);
  res.status(HttpStatus.CREATED).json({ data: result });
}

export async function getLinkStatus(req: Request, res: Response): Promise<void> {
  const auth = getAuth(req);
  const status = await telegramService.getTelegramLinkStatus(auth.userId);
  res.status(HttpStatus.OK).json({ data: status });
}

export async function unlinkTelegram(req: Request, res: Response): Promise<void> {
  const auth = getAuth(req);
  await telegramService.unlinkTelegram(auth.userId);
  res.status(HttpStatus.OK).json({ data: { unlinked: true } });
}

export async function broadcastAuction(req: Request, res: Response): Promise<void> {
  const auctionId = String(req.params.auctionId);
  const broadcasted = await telegramService.broadcastAuction(auctionId);
  res.status(HttpStatus.OK).json({ data: { broadcasted } });
}
