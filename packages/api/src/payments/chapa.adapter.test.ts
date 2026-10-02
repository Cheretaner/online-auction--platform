import { describe, expect, it } from "vitest";
import { ChapaAdapter } from "./chapa.adapter.js";

describe("ChapaAdapter", () => {
  it("accepts only Chapa's HTTPS hosted-checkout URL", async () => {
    const adapter = new ChapaAdapter(async () => new Response(JSON.stringify({
      status: "success",
      data: { checkout_url: "https://checkout.chapa.co/checkout/payment/test" },
    }), { status: 200 }));
    const checkoutUrl = await adapter.initialize({
      txRef: "dep-test-reference",
      amount: "100.00",
      email: "bidder@example.test",
      firstName: "Test",
      lastName: "Bidder",
      returnUrl: "https://auction.example.test/app/deposits",
    });
    expect(checkoutUrl).toBe("https://checkout.chapa.co/checkout/payment/test");

    const untrusted = new ChapaAdapter(async () => new Response(JSON.stringify({
      status: "success",
      data: { checkout_url: "https://attacker.example/pay" },
    }), { status: 200 }));
    await expect(untrusted.initialize({
      txRef: "dep-test-reference",
      amount: "100.00",
      email: "bidder@example.test",
      firstName: "Test",
      lastName: "Bidder",
      returnUrl: "https://auction.example.test/app/deposits",
    })).rejects.toThrow("untrusted checkout URL");
  });

  it("normalizes verified transaction details for local matching", async () => {
    const adapter = new ChapaAdapter(async () => new Response(JSON.stringify({
      status: "success",
      data: {
        tx_ref: "dep-test-reference",
        status: "success",
        amount: 100,
        currency: "ETB",
        reference: "chapa-reference",
      },
    }), { status: 200 }));
    await expect(adapter.verify("dep-test-reference")).resolves.toEqual({
      txRef: "dep-test-reference",
      status: "success",
      amount: "100",
      currency: "ETB",
      providerReference: "chapa-reference",
    });
  });

  it("initiates and verifies full refunds using Chapa references", async () => {
    const responses = [
      { status: "success", data: { ref_id: "refund-ref" } },
      { status: "success", data: { status: "refunded", ref_id: "refund-ref" } },
    ];
    const adapter = new ChapaAdapter(async () => new Response(JSON.stringify(responses.shift()), { status: 200 }));
    await expect(adapter.refund("dep-payment-ref", "refund-unique-ref", "Non-winning auction deposit"))
      .resolves.toBe("refund-ref");
    await expect(adapter.verifyRefund("refund-ref")).resolves.toEqual({
      status: "refunded",
      reference: "refund-ref",
    });
  });
});