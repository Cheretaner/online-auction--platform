import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryOne } from "../infrastructure/database/query.js";
import { withTransaction } from "../infrastructure/database/tx.js";
import * as repo from "./watchlist.repository.js";
import { setWatchlist } from "./watchlist.service.js";

vi.mock("../infrastructure/database/query.js", () => ({ queryOne: vi.fn() }));
vi.mock("../infrastructure/database/tx.js", () => ({
  withTransaction: vi.fn(async (operation: (client: unknown) => Promise<unknown>) => operation({})),
}));
vi.mock("./watchlist.repository.js", () => ({
  listByUser: vi.fn(),
  findAuction: vi.fn(),
  isTelegramLinked: vi.fn(),
  countUserAuctions: vi.fn(),
  countAuctionUsers: vi.fn(),
  replaceForAuction: vi.fn(),
  removeForAuction: vi.fn(),
}));

describe("watchlist service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(queryOne).mockResolvedValue(null);
    vi.mocked(repo.findAuction).mockResolvedValue({ title: "Open auction", status: "live" });
    vi.mocked(repo.isTelegramLinked).mockResolvedValue(true);
    vi.mocked(repo.countUserAuctions).mockResolvedValue(0);
    vi.mocked(repo.countAuctionUsers).mockResolvedValue(0);
    vi.mocked(repo.listByUser).mockResolvedValue([]);
  });

  it("deduplicates selected channels and replaces preferences transactionally", async () => {
    await setWatchlist({
      userId: "11111111-1111-4111-8111-111111111111",
      auctionId: "22222222-2222-4222-8222-222222222222",
      channels: ["in_app", "email", "in_app"],
      alertOnBids: true,
      alertOnStatus: false,
    });

    expect(repo.replaceForAuction).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
      ["in_app", "email"],
      true,
      false,
    );
    expect(withTransaction).toHaveBeenCalledWith(expect.any(Function), {
      userId: "11111111-1111-4111-8111-111111111111",
    });
  });

  it("rejects auctions that have already closed", async () => {
    vi.mocked(repo.findAuction).mockResolvedValue({ title: "Closed auction", status: "closed" });

    await expect(setWatchlist({
      userId: "11111111-1111-4111-8111-111111111111",
      auctionId: "22222222-2222-4222-8222-222222222222",
      channels: ["in_app"],
      alertOnBids: true,
      alertOnStatus: true,
    })).rejects.toThrow("You can follow auctions after they are scheduled and before bidding closes");
    expect(repo.replaceForAuction).not.toHaveBeenCalled();
  });

  it("requires Telegram to be linked before enabling Telegram alerts", async () => {
    vi.mocked(repo.isTelegramLinked).mockResolvedValue(false);

    await expect(setWatchlist({
      userId: "11111111-1111-4111-8111-111111111111",
      auctionId: "22222222-2222-4222-8222-222222222222",
      channels: ["telegram"],
      alertOnBids: false,
      alertOnStatus: true,
    })).rejects.toThrow("Link Telegram in your account settings before selecting Telegram alerts");
    expect(repo.replaceForAuction).not.toHaveBeenCalled();
  });

  it("rejects preferences with no enabled alert type", async () => {
    await expect(setWatchlist({
      userId: "11111111-1111-4111-8111-111111111111",
      auctionId: "22222222-2222-4222-8222-222222222222",
      channels: ["in_app"],
      alertOnBids: false,
      alertOnStatus: false,
    })).rejects.toThrow("Select at least one alert type");
    expect(withTransaction).not.toHaveBeenCalled();
  });
});