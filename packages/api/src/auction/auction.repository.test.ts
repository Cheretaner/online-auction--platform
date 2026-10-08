import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  queryAll: vi.fn(),
  queryOne: vi.fn(),
}));

vi.mock("../infrastructure/database/query.js", () => ({
  query: vi.fn(),
  queryOne: mocks.queryOne,
  queryAll: mocks.queryAll,
}));

import { listByOrgId, listPublicAuctions } from "./auction.repository.js";

describe("listByOrgId", () => {
  beforeEach(() => {
    mocks.queryAll.mockReset().mockResolvedValue([]);
  });

  it("filters by auction status before applying the requested page limit", async () => {
    await expect(listByOrgId("org-id", 500, undefined, undefined, "draft")).resolves.toEqual({
      items: [],
      nextCursor: null,
    });

    expect(mocks.queryAll).toHaveBeenCalledWith(
      expect.stringContaining("WHERE org_id = $1 AND status = $2"),
      ["org-id", "draft", 501],
      undefined,
    );
  });

  it("keeps the existing unfiltered organization listing behavior", async () => {
    await listByOrgId("org-id");

    expect(mocks.queryAll).toHaveBeenCalledWith(
      expect.not.stringContaining("AND status"),
      ["org-id", 51],
      undefined,
    );
  });

  it("excludes auctions owned by inactive organizations from the public catalogue", async () => {
    mocks.queryOne.mockResolvedValue({ total: "0" });
    await listPublicAuctions({ limit: 20, offset: 0 });

    expect(mocks.queryOne).toHaveBeenCalledWith(
      expect.stringContaining("o.is_active = TRUE"),
      [20, 0],
      undefined,
    );
    expect(mocks.queryAll).toHaveBeenCalledWith(
      expect.stringContaining("o.is_active = TRUE"),
      [20, 0],
      undefined,
    );
  });
});
