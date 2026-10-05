import { beforeEach, describe, expect, it, vi } from "vitest";
import { query, queryOne } from "../infrastructure/database/query.js";
import { createOrGetRefund } from "./payment.repository.js";
import { markSealedOpened } from "../bidding/bidding.repository.js";

vi.mock("../infrastructure/database/query.js", () => ({
  query: vi.fn(),
  queryAll: vi.fn(),
  queryOne: vi.fn(),
}));

describe("payment repository refund upsert", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refreshes refund metadata when the refund record already exists", async () => {
    vi.mocked(queryOne).mockResolvedValue({
      id: "refund-1",
      provider_transaction_id: "tx-1",
      deposit_id: "deposit-1",
      bidder_id: "bidder-1",
      auction_id: "auction-1",
      tx_ref: "tx-ref-1",
      merchant_reference: "refund-tx-ref-1",
      provider_reference: null,
      amount: "2500.00",
      status: "requested",
      reason: "Non-winning auction deposit",
    });

    await createOrGetRefund({
      transactionId: "tx-1",
      depositId: "deposit-1",
      merchantReference: "refund-tx-ref-1",
      amount: "2500.00",
      reason: "Non-winning auction deposit",
    });

    expect(vi.mocked(queryOne)).toHaveBeenCalledTimes(1);
    const sql = vi.mocked(queryOne).mock.calls[0][0] as string;
    expect(sql).toContain("ON CONFLICT (provider_transaction_id) DO UPDATE SET");
    expect(sql).toContain("merchant_reference = EXCLUDED.merchant_reference");
    expect(sql).toContain("amount = EXCLUDED.amount");
    expect(sql).toContain("reason = EXCLUDED.reason");
  });
});

describe("bidding repository sealed opening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records a closure timestamp when the official opening ceremony finalizes a sealed auction", async () => {
    vi.mocked(query).mockResolvedValue({
      rows: [{
        id: "auction-1",
        org_id: "org-1",
        title: "Sealed auction",
        auction_type: "sealed_bid",
        status: "closed",
        start_price: "100.00",
        reserve_price: "150.00",
        min_increment: "5.00",
        deposit_amount: "10.00",
        current_highest_bid: "200.00",
        bid_count: 1,
        opens_at: new Date("2024-01-01T00:00:00.000Z"),
        closes_at: new Date("2024-01-02T00:00:00.000Z"),
        original_closes_at: new Date("2024-01-02T00:00:00.000Z"),
        extension_count: 0,
        anti_snipe_seconds: null,
        max_extensions: null,
        created_by: "creator-1",
        approved_by: "approver-1",
        winner_id: "bidder-1",
        sealed_opened_at: new Date("2024-01-03T00:00:00.000Z"),
      }],
    } as any);

    await markSealedOpened("auction-1", "officer-1", {
      winnerId: "bidder-1",
      winningAmount: "200.00",
    });

    const sql = vi.mocked(query).mock.calls[0][0] as string;
    expect(sql).toContain("closed_at = COALESCE(closed_at, NOW())");
    expect(sql).toContain("winner_id = $3");
  });
});
