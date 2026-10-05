import { beforeEach, describe, expect, it, vi } from "vitest";
import { SubmitVerificationRequest } from "@auction/shared";
import { VerificationService } from "./verification.service.js";
import * as documentService from "../document/document.service.js";

vi.mock("../document/document.service.js", () => ({
  getDocument: vi.fn(),
}));

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

  it("rejects duplicate national IDs before a new verification is accepted", async () => {
    const service = new VerificationService({
      precheck: async () => ({ provider: "manual", outcome: "manual_review", reference: null }),
    });

    (service as any).identityRepo = {
      findProfileById: vi.fn().mockResolvedValue({
        id: "profile-2",
        nationalId: "123456789012",
        tinNumber: null,
      }),
    };

    (service as any).repository = {
      getPendingVerification: vi.fn().mockResolvedValue(null),
      createVerification: vi.fn().mockResolvedValue({
        id: "00000000-0000-0000-0000-000000000001",
        userId: "user-1",
        documentType: "national_id",
        documentNumber: "123456789012",
        documentId,
        status: "pending",
        decision: null,
        decisionReason: null,
        reviewedBy: null,
        reviewedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
      checkDuplicateNationalIdOrTin: vi.fn().mockResolvedValue([{ id: "profile-2" }]),
    };

    vi.mocked(documentService.getDocument).mockResolvedValue({
      id: documentId,
      uploadedBy: "user-1",
      isPrivate: true,
      documentType: "identity_document",
      checksumSha256: "abc",
    } as any);

    await expect(
      service.submit(
        { userId: "user-1", roles: ["bidder"] },
        { documentType: "national_id", documentNumber: "123456789012", documentId },
      ),
    ).rejects.toMatchObject({ message: expect.stringContaining("already in use") });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });
});