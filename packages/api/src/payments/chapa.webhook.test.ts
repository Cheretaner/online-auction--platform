import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { CreateDepositRequest } from "@auction/shared";
import { isChapaEventFresh } from "./chapa.controller.js";
import { verifyChapaWebhookSignature } from "./payment.service.js";

describe("Chapa webhook security", () => {
  it("verifies the documented HMAC signature and rejects tampering", () => {
    const event = { event: "charge.success", data: { tx_ref: "dep-test-reference", status: "success" } };
    const signature = createHmac("sha256", "test-webhook-secret").update(JSON.stringify(event)).digest("hex");
    expect(verifyChapaWebhookSignature(event, signature, "test-webhook-secret")).toBe(true);
    expect(verifyChapaWebhookSignature(event, `sha256=${signature}`, "test-webhook-secret")).toBe(true);
    expect(verifyChapaWebhookSignature({ ...event, event: "charge.failed" }, signature, "test-webhook-secret")).toBe(false);
    expect(verifyChapaWebhookSignature(event, undefined, "test-webhook-secret")).toBe(false);
  });

  it("allows delivery retries within 72 hours and rejects stale or future timestamps", () => {
    const now = Date.parse("2026-10-02T12:00:00.000Z");
    expect(isChapaEventFresh("2026-10-02T11:00:00.000Z", now)).toBe(true);
    expect(isChapaEventFresh("2026-09-28T11:59:59.000Z", now)).toBe(false);
    expect(isChapaEventFresh("2026-10-02T12:06:00.000Z", now)).toBe(false);
    expect(isChapaEventFresh(undefined, now)).toBe(false);
  });

  it("accepts Chapa as a valid deposit instrument type in the shared contract", () => {
    const parsed = CreateDepositRequest.parse({
      auctionId: "11111111-1111-4111-8111-111111111111",
      amount: "50000.00",
      referenceNumber: "dep-chapa-123",
      issuingBank: "Commercial Bank of Ethiopia",
      instrumentType: "chapa",
      documentId: "22222222-2222-4222-8222-222222222222",
    });

    expect(parsed.instrumentType).toBe("chapa");
  });
});