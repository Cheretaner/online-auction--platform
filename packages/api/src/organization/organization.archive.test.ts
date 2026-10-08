import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  withTransaction: vi.fn(async (callback: (client: unknown) => Promise<unknown>) => callback({})),
  findById: vi.fn(),
  listAuctionsForGeneratedOrganization: vi.fn(),
  updateOrganization: vi.fn(),
  cancelAuction: vi.fn(),
  appendAuditEvent: vi.fn(),
  actorRoleOf: vi.fn(() => "super_admin"),
}));

vi.mock("../infrastructure/database/tx.js", () => ({
  withTransaction: mocks.withTransaction,
}));
vi.mock("../identity/identity.repository.js", () => ({
  IdentityRepository: class {},
}));
vi.mock("../notification/notification.service.js", () => ({
  enqueueNotification: vi.fn(),
}));
vi.mock("../audit/audit.service.js", () => ({
  appendAuditEvent: mocks.appendAuditEvent,
  actorRoleOf: mocks.actorRoleOf,
}));
vi.mock("../auction/auction.service.js", () => ({
  cancelAuction: mocks.cancelAuction,
}));
vi.mock("./organization.repository.js", () => ({
  findById: mocks.findById,
  listAuctionsForGeneratedOrganization: mocks.listAuctionsForGeneratedOrganization,
  updateOrganization: mocks.updateOrganization,
}));

import { archiveGeneratedOrganization } from "./organization.service.js";

const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const auctionId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const actor = { userId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", roles: ["super_admin" as const] };

const organization = {
  id: organizationId,
  name: "Org aaaaaaaa",
  slug: `org-${organizationId}`,
  orgType: "government" as const,
  taxpayerId: organizationId.slice(0, 10),
  region: null,
  contactEmail: null,
  contactPhone: null,
  logoUrl: null,
  isActive: true,
  onboardedBy: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("archiveGeneratedOrganization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findById.mockResolvedValue(organization);
    mocks.listAuctionsForGeneratedOrganization.mockResolvedValue([
      { id: auctionId, title: "Auction bbbbbbbb", status: "live" },
    ]);
    mocks.updateOrganization.mockResolvedValue({ ...organization, isActive: false });
  });

  it("cancels generated auctions and deactivates the generated organization", async () => {
    const result = await archiveGeneratedOrganization(organizationId, actor);

    expect(mocks.cancelAuction).toHaveBeenCalledWith(
      auctionId,
      organizationId,
      actor,
      "Generated fixture data archived by a platform administrator",
    );
    expect(mocks.updateOrganization).toHaveBeenCalledWith(organizationId, { isActive: false });
    expect(result.cancelledAuctions).toBe(1);
    expect(result.organization.isActive).toBe(false);
  });

  it("refuses organizations with non-generated auctions before changing anything", async () => {
    mocks.listAuctionsForGeneratedOrganization.mockResolvedValue([
      { id: auctionId, title: "Real public auction", status: "live" },
    ]);

    await expect(archiveGeneratedOrganization(organizationId, actor)).rejects.toThrow(
      "This organization has auctions outside the generated fixture pattern",
    );
    expect(mocks.cancelAuction).not.toHaveBeenCalled();
    expect(mocks.updateOrganization).not.toHaveBeenCalled();
  });

  it("refuses manually named organizations", async () => {
    mocks.findById.mockResolvedValue({ ...organization, name: "Manually created organization" });

    await expect(archiveGeneratedOrganization(organizationId, actor)).rejects.toThrow(
      "Only organizations matching the generated fixture pattern can be archived",
    );
    expect(mocks.listAuctionsForGeneratedOrganization).not.toHaveBeenCalled();
    expect(mocks.cancelAuction).not.toHaveBeenCalled();
    expect(mocks.updateOrganization).not.toHaveBeenCalled();
  });
});
