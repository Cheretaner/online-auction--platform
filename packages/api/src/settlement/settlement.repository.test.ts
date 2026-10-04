import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryOne } from "../infrastructure/database/query.js";
import { createForAward } from "./settlement.repository.js";

vi.mock("../infrastructure/database/query.js", () => ({
  query: vi.fn(),
  queryAll: vi.fn(),
  queryOne: vi.fn(),
}));

describe("settlement repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates the award record when a settlement obligation already exists for the auction", async () => {
    vi.mocked(queryOne).mockResolvedValue({
      id: "settlement-1",
      auction_id: "auction-1",
      winner_id: "winner-2",
      amount: "245000.00",
      currency: "ETB",
      status: "due",
      due_at: new Date("2026-10-10T10:00:00.000Z"),
      paid_at: null,
      created_at: new Date("2026-10-01T00:00:00.000Z"),
      updated_at: new Date("2026-10-01T00:00:00.000Z"),
    });

    const obligation = await createForAward({
      auctionId: "auction-1",
      winnerId: "winner-2",
      amount: "245000.00",
    });

    expect(obligation.amount).toBe("245000.00");
    expect(obligation.winnerId).toBe("winner-2");
    expect(vi.mocked(queryOne)).toHaveBeenCalledWith(
      expect.stringContaining("ON CONFLICT (auction_id) DO UPDATE SET"),
      expect.any(Array),
      undefined,
    );
    const sql = vi.mocked(queryOne).mock.calls[0][0] as string;
    expect(sql).toContain("winner_id = CASE");
    expect(sql).toContain("ELSE EXCLUDED.winner_id");
    expect(sql).toContain("amount = CASE");
    expect(sql).toContain("ELSE EXCLUDED.amount");
    expect(sql).toContain("status = CASE");
    expect(sql).toContain("ELSE 'due'");
  });

  it("preserves a settled outcome instead of resetting a paid winner obligation", async () => {
    vi.mocked(queryOne).mockResolvedValue({
      id: "settlement-1",
      auction_id: "auction-1",
      winner_id: "winner-2",
      amount: "245000.00",
      currency: "ETB",
      status: "paid",
      due_at: new Date("2026-10-10T10:00:00.000Z"),
      paid_at: new Date("2026-10-09T10:00:00.000Z"),
      created_at: new Date("2026-10-01T00:00:00.000Z"),
      updated_at: new Date("2026-10-10T00:00:00.000Z"),
    });

    await createForAward({
      auctionId: "auction-1",
      winnerId: "winner-2",
      amount: "245000.00",
    });

    const sql = vi.mocked(queryOne).mock.calls[0][0] as string;
    expect(sql).toContain("WHEN settlement_obligations.status IN ('paid', 'payment_pending', 'reconciliation_required')");
  });
});
