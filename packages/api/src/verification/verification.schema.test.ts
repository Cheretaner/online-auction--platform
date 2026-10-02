import { describe, expect, it } from "vitest";
import { SubmitVerificationRequest } from "@auction/shared";

describe("identity verification submission validation", () => {
  const documentId = "7b5b4ad7-96e2-4a5c-817e-22e9dd690b6d";

  it("requires a Fayda number to contain the official 12 digits", () => {
    expect(SubmitVerificationRequest.safeParse({
      documentType: "national_id",
      documentNumber: "123456789012",
      documentId,
    }).success).toBe(true);
    expect(SubmitVerificationRequest.safeParse({
      documentType: "national_id",
      documentNumber: "12345678901",
      documentId,
    }).success).toBe(false);
  });

  it("requires a linked private-evidence identifier and bounds other document numbers", () => {
    expect(SubmitVerificationRequest.safeParse({
      documentType: "passport",
      documentNumber: "AB1234567",
      documentId,
    }).success).toBe(true);
    expect(SubmitVerificationRequest.safeParse({
      documentType: "kebele_id",
      documentNumber: "K-12/345",
    }).success).toBe(false);
  });
});