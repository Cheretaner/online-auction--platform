import type { RequestHandler } from "express";
import { HttpStatus } from "../shared/errors/index.js";
import { AppError } from "../shared/errors/index.js";
import { asyncHandler } from "../shared/middleware/asyncHandler.js";
import { processChapaWebhook, verifyChapaWebhookSignature, webhookEventHash } from "./payment.service.js";

const MAX_WEBHOOK_AGE_MS = 72 * 60 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function isChapaEventFresh(value: unknown, now = Date.now()): boolean {
  if (typeof value !== "string") return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp <= now + MAX_FUTURE_SKEW_MS && now - timestamp <= MAX_WEBHOOK_AGE_MS;
}

export const chapaWebhook: RequestHandler = asyncHandler(async (req, res) => {
  const payload = req.body as unknown;
  const signature = req.get("x-chapa-signature") ?? req.get("chapa-signature");
  if (!verifyChapaWebhookSignature(payload, signature)) {
    throw new AppError("Invalid Chapa webhook signature", HttpStatus.UNAUTHORIZED);
  }

  const body = object(payload);
  const data = object(body?.data);
  const eventTime = data?.updated_at ?? body?.updated_at ?? data?.created_at ?? body?.created_at;
  if (!isChapaEventFresh(eventTime)) {
    throw AppError.badRequest("Chapa webhook timestamp is missing or outside the replay window");
  }

  const txRef = data?.tx_ref ?? body?.tx_ref ?? data?.reference;
  if (typeof txRef !== "string" || txRef.length < 8 || txRef.length > 100) {
    throw AppError.badRequest("Chapa webhook has no valid transaction reference");
  }

  const result = await processChapaWebhook(txRef, webhookEventHash(payload));
  if (result === "pending") {
    res.status(HttpStatus.SERVICE_UNAVAILABLE).json({ error: { message: "Payment verification is pending" } });
    return;
  }
  res.status(HttpStatus.OK).json({ received: true, processed: result === "processed" });
});