import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@auction/shared";
import type { DocumentRecord } from "./document.types.js";

const { findAuctionOwner, hasPaidDocumentAccess } = vi.hoisted(() => ({
  findAuctionOwner: vi.fn(),
  hasPaidDocumentAccess: vi.fn(),
}));

vi.mock("../shared/authz/auction-access.js", () => ({ findAuctionOwner }));
vi.mock("./document-access.service.js", () => ({ hasPaidDocumentAccess }));

import { canReadDocument } from "./document.service.js";

const document: DocumentRecord = {
  id: "doc-1",
  auctionId: "auction-1",
  uploadedBy: "uploader-1",
  documentType: "specification",
  fileName: "spec.pdf",
  storagePath: "internal/path",
  mimeType: "application/pdf",
  fileSizeBytes: 12,
  checksumSha256: "abc",
  isPrivate: true,
  requiresPayment: true,
  summary: null,
  extractedText: null,
  ocrStatus: "not_started",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("paid document authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findAuctionOwner.mockResolvedValue({ orgId: "org-1" });
    hasPaidDocumentAccess.mockResolvedValue(false);
  });

  it("denies unpaid bidders access to private paid documents", async () => {
    await expect(canReadDocument(document, {
      userId: "bidder-1",
      roles: ["bidder"],
    })).resolves.toBe(false);
    expect(hasPaidDocumentAccess).toHaveBeenCalledWith("auction-1", "bidder-1");
  });

  it("enforces payment even if a paid document was incorrectly marked public", async () => {
    const publicPaidDocument = { ...document, isPrivate: false };
    await expect(canReadDocument(publicPaidDocument, {
      userId: "bidder-1",
      roles: ["bidder"],
    })).resolves.toBe(false);
    hasPaidDocumentAccess.mockResolvedValue(true);
    await expect(canReadDocument(publicPaidDocument, {
      userId: "bidder-1",
      roles: ["bidder"],
    })).resolves.toBe(true);
  });

  it("allows a bidder to read a paid document after successful payment", async () => {
    hasPaidDocumentAccess.mockResolvedValue(true);
    await expect(canReadDocument(document, {
      userId: "bidder-1",
      roles: ["bidder"],
    })).resolves.toBe(true);
  });

  it("does not require payment from the uploader or super admin", async () => {
    await expect(canReadDocument(document, {
      userId: "uploader-1",
      roles: ["bidder"],
    })).resolves.toBe(true);
    await expect(canReadDocument(document, {
      userId: "admin-1",
      roles: ["super_admin"],
    })).resolves.toBe(true);
    expect(hasPaidDocumentAccess).not.toHaveBeenCalled();
  });

  it("allows auction staff for their own organization but not another organization's staff", async () => {
    const staff = { userId: "officer-1", roles: ["auction_officer"] as Role[], organizationId: "org-1" };
    await expect(canReadDocument(document, staff)).resolves.toBe(true);
    await expect(canReadDocument(document, { ...staff, organizationId: "org-2" })).resolves.toBe(false);
    expect(findAuctionOwner).toHaveBeenCalledWith("auction-1");
  });

  it("continues to allow public non-paywalled documents without payment", async () => {
    const publicDocument = { ...document, isPrivate: false, requiresPayment: false };
    await expect(canReadDocument(publicDocument, {
      userId: "bidder-1",
      roles: ["bidder"],
    })).resolves.toBe(true);
    expect(hasPaidDocumentAccess).not.toHaveBeenCalled();
  });

  it("keeps ordinary private operational documents hidden from other bidders", async () => {
    const internalDocument = { ...document, requiresPayment: false };
    await expect(canReadDocument(internalDocument, {
      userId: "bidder-1",
      roles: ["bidder"],
    })).resolves.toBe(false);
    expect(hasPaidDocumentAccess).not.toHaveBeenCalled();
  });
});
