import { z } from "zod";
import { env } from "../config/env.js";

const initializeResponseSchema = z.object({
  status: z.string(),
  data: z.object({ checkout_url: z.string().url() }).optional(),
  message: z.string().optional(),
});

const verifyResponseSchema = z.object({
  status: z.string(),
  data: z.object({
    tx_ref: z.string(),
    status: z.string(),
    amount: z.union([z.string(), z.number()]),
    currency: z.string(),
    reference: z.string().optional(),
    ref_id: z.string().optional(),
  }),
});

const refundResponseSchema = z.object({
  status: z.string(),
  data: z.object({ ref_id: z.string().optional() }).optional(),
});

const refundVerificationSchema = z.object({
  status: z.string(),
  data: z.object({
    status: z.string(),
    ref_id: z.string(),
    payment_reference: z.string().optional(),
  }),
});

export interface ChapaVerification {
  txRef: string;
  status: string;
  amount: string;
  currency: string;
  providerReference: string | null;
}

export class ChapaAdapter {
  constructor(private readonly request: typeof fetch = fetch) {}

  async initialize(input: {
    txRef: string;
    amount: string;
    email: string;
    firstName: string;
    lastName: string;
    returnUrl: string;
    customization?: { title: string; description: string };
  }): Promise<string> {
    const response = await this.request("https://api.chapa.co/v1/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.CHAPA_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: input.amount,
        currency: "ETB",
        email: input.email,
        first_name: input.firstName,
        last_name: input.lastName,
        tx_ref: input.txRef,
        return_url: input.returnUrl,
        customization: input.customization ?? {
          title: "Auction bid security",
          description: "Bid security deposit",
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const payload = initializeResponseSchema.safeParse(await response.json().catch(() => null));
    if (!response.ok || !payload.success || payload.data.status !== "success" || !payload.data.data?.checkout_url) {
      throw new Error("Chapa could not initialize the payment");
    }
    const checkoutUrl = new URL(payload.data.data.checkout_url);
    if (checkoutUrl.protocol !== "https:" || checkoutUrl.hostname !== "checkout.chapa.co") {
      throw new Error("Chapa returned an untrusted checkout URL");
    }
    return checkoutUrl.toString();
  }

  async verify(txRef: string): Promise<ChapaVerification> {
    const response = await this.request(
      `https://api.chapa.co/v1/transaction/verify/${encodeURIComponent(txRef)}`,
      {
        headers: { Authorization: `Bearer ${env.CHAPA_SECRET_KEY}` },
        signal: AbortSignal.timeout(15_000),
      },
    );
    const payload = verifyResponseSchema.safeParse(await response.json().catch(() => null));
    if (!response.ok || !payload.success || payload.data.status !== "success") {
      throw new Error("Chapa could not verify the payment");
    }
    const transaction = payload.data.data;
    return {
      txRef: transaction.tx_ref,
      status: transaction.status,
      amount: String(transaction.amount),
      currency: transaction.currency,
      providerReference: transaction.reference ?? transaction.ref_id ?? null,
    };
  }

  async refund(txRef: string, merchantReference: string, reason: string): Promise<string> {
    const response = await this.request(`https://api.chapa.co/v1/refund/${encodeURIComponent(txRef)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.CHAPA_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reference: merchantReference, reason }),
      signal: AbortSignal.timeout(15_000),
    });
    const payload = refundResponseSchema.safeParse(await response.json().catch(() => null));
    if (!response.ok || !payload.success || payload.data.status !== "success" || !payload.data.data?.ref_id) {
      throw new Error("Chapa could not initiate the refund");
    }
    return payload.data.data.ref_id;
  }

  async verifyRefund(refundReference: string): Promise<{ status: string; reference: string }> {
    const response = await this.request(
      `https://api.chapa.co/v1/refund/${encodeURIComponent(refundReference)}/verify`,
      {
        headers: { Authorization: `Bearer ${env.CHAPA_SECRET_KEY}` },
        signal: AbortSignal.timeout(15_000),
      },
    );
    const payload = refundVerificationSchema.safeParse(await response.json().catch(() => null));
    if (!response.ok || !payload.success || payload.data.status !== "success") {
      throw new Error("Chapa could not verify the refund");
    }
    return { status: payload.data.data.status, reference: payload.data.data.ref_id };
  }
}