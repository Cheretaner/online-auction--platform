import { describe, expect, it } from "vitest";
import { commandCenterActionPath, prioritizeExceptions } from "./command-center.service.js";

describe("commandCenterActionPath", () => {
  it.each([
    ["verification", "verification-1", null, "/app/kyc/review?recordId=verification-1"],
    ["deposit", "deposit-1", "auction-1", "/app/auctions/auction-1?recordId=deposit-1&source=deposit"],
    ["dispute", "dispute-1", "auction-1", "/app/disputes?recordId=dispute-1&source=dispute"],
    ["anomaly", "anomaly-1", "auction-1", "/app/ai?flagId=anomaly-1"],
  ] as const)(
    "builds a record-aware route for %s exceptions",
    (source, id, auctionId, expected) => {
      expect(commandCenterActionPath({
        id,
        source,
        title: "Exception",
        status: "open",
        severity: "high",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        auctionId,
        actionPath: "",
      })).toBe(expected);
    },
  );
});

describe("prioritizeExceptions", () => {
  it("orders unresolved high-severity exceptions by age before lower-priority items", () => {
    const result = prioritizeExceptions([
      {
        id: "old-medium",
        source: "dispute",
        title: "Older dispute",
        status: "open",
        severity: "medium",
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
        auctionId: "auction-1",
        actionPath: "/app/disputes",
      },
      {
        id: "new-high",
        source: "anomaly",
        title: "New high-risk anomaly",
        status: "open",
        severity: "high",
        createdAt: "2025-02-01T00:00:00.000Z",
        updatedAt: "2025-02-01T00:00:00.000Z",
        auctionId: "auction-2",
        actionPath: "/app/ai",
      },
      {
        id: "old-high",
        source: "verification",
        title: "Older KYC exception",
        status: "pending",
        severity: "high",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
        auctionId: null,
        actionPath: "/app/kyc/review",
      },
      {
        id: "resolved",
        source: "deposit",
        title: "Resolved deposit",
        status: "released",
        severity: "high",
        createdAt: "2023-01-01T00:00:00.000Z",
        updatedAt: "2023-01-01T00:00:00.000Z",
        auctionId: "auction-3",
        actionPath: "/app/deposits",
      },
    ]);

    expect(result.map((item) => item.id)).toEqual(["new-high", "old-high", "old-medium"]);
  });
});
