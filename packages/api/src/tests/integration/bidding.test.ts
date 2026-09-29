import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { cleanupTestData, createTestOrg, createTestUser, addOrgOfficer } from "../setup.js";
import { getPool } from "../../infrastructure/database/pool.js";
import * as BiddingService from "../../bidding/bidding.service.js";
import { BiddingError } from "../../bidding/bidding.errors.js";

describe("Bidding Integration Tests", () => {
  let pool = getPool();
  
  beforeEach(async () => {
    pool = getPool();
    await cleanupTestData();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  async function createLiveAuction(depositAmount = "0.00", creatorId?: string) {
    const creator = creatorId || (await createTestUser("officer")).id;
    const org = await createTestOrg();
    await addOrgOfficer(org.id, creator);

    const auctionId = crypto.randomUUID();
    const now = new Date();
    const opensAt = new Date(now.getTime() - 10000).toISOString();
    const closesAt = new Date(now.getTime() + 100000).toISOString();

    await pool.query(
      `INSERT INTO auctions (id, org_id, created_by, title, auction_type, status, start_price, current_highest_bid, deposit_amount, opens_at, closes_at) 
       VALUES ($1, $2, $3, 'Test', 'open_ascending', 'live', '100.00', '100.00', $4, $5, $6)`,
      [auctionId, org.id, creator, depositAmount, opensAt, closesAt]
    );

    return { auctionId, orgId: org.id, creatorId: creator };
  }

  describe("Eligibility rules", () => {
    it("Unverified user can't bid", async () => {
      const { auctionId } = await createLiveAuction();
      const unverifiedUser = await createTestUser("bidder", "pending");

      await expect(
        BiddingService.placeBid({
          auctionId,
          bidderId: unverifiedUser.id,
          roles: ["bidder"],
          body: { amount: "150.00" },
          idempotencyKey: crypto.randomUUID()
        })
      ).rejects.toThrowError(new BiddingError("Bidder is not verified", "NOT_VERIFIED"));
    });

    it("User without deposit can't bid", async () => {
      const { auctionId } = await createLiveAuction("10.00");
      const user = await createTestUser("bidder");

      await expect(
        BiddingService.placeBid({
          auctionId,
          bidderId: user.id,
          roles: ["bidder"],
          body: { amount: "150.00" },
          idempotencyKey: crypto.randomUUID()
        })
      ).rejects.toThrowError(new BiddingError("Verified deposit is required", "DEPOSIT_REQUIRED"));
    });
  });

  describe("Minimum increment", () => {
    it("Bid below minimum rejected", async () => {
      const { auctionId } = await createLiveAuction();
      const user = await createTestUser("bidder");

      // Set minimum_increment in DB if required, but default behavior is amount must be > highest.
      // Wait, let's just bid below start price.
      await expect(
        BiddingService.placeBid({
          auctionId,
          bidderId: user.id,
          roles: ["bidder"],
          body: { amount: "50.00" },
          idempotencyKey: crypto.randomUUID()
        })
      ).rejects.toThrowError(new BiddingError("Bid below minimum", "BID_BELOW_MINIMUM"));
    });
  });

  describe("Self-bid prevention", () => {
    it("Auction creator/officer can't bid", async () => {
      const { auctionId, creatorId, orgId } = await createLiveAuction();
      
      await expect(
        BiddingService.placeBid({
          auctionId,
          bidderId: creatorId,
          roles: ["officer"],
          organizationId: orgId,
          body: { amount: "150.00" },
          idempotencyKey: crypto.randomUUID()
        })
      ).rejects.toThrowError(new BiddingError("Self bidding is not allowed", "SELF_BIDDING"));
      
      const otherOfficer = await createTestUser("officer");
      await addOrgOfficer(orgId, otherOfficer.id);

      await expect(
        BiddingService.placeBid({
          auctionId,
          bidderId: otherOfficer.id,
          roles: ["officer"],
          organizationId: orgId,
          body: { amount: "150.00" },
          idempotencyKey: crypto.randomUUID()
        })
      ).rejects.toThrowError(new BiddingError("Self bidding is not allowed", "SELF_BIDDING"));
    });
  });

  describe("Concurrent bids", () => {
    it("Submit 20 bids simultaneously -> verify consistent highest bid and count", async () => {
      const { auctionId } = await createLiveAuction();
      const bidders = await Promise.all(
        Array.from({ length: 20 }).map(() => createTestUser("bidder"))
      );

      const promises = bidders.map((bidder, i) => {
        const amount = (110 + i * 10).toFixed(2);
        return BiddingService.placeBid({
          auctionId,
          bidderId: bidder.id,
          roles: ["bidder"],
          body: { amount },
          idempotencyKey: crypto.randomUUID()
        }).catch(() => null); // ignore race condition rejections if any
      });

      await Promise.all(promises);

      const result = await pool.query("SELECT current_highest_bid, bid_count FROM auctions WHERE id = $1", [auctionId]);
      const auction = result.rows[0];
      
      // Highest bid should be exactly the max of all valid bids (300.00 since 110 + 19 * 10 = 300)
      expect(Number(auction.current_highest_bid)).toBe(300);
      expect(Number(auction.bid_count)).toBe(20);
    });
  });

  describe("Idempotency", () => {
    it("Same idempotency key -> replay response, not duplicate bid", async () => {
      const { auctionId } = await createLiveAuction();
      const user = await createTestUser("bidder");
      const idempotencyKey = crypto.randomUUID();

      const firstRes = await BiddingService.placeBid({
        auctionId,
        bidderId: user.id,
        roles: ["bidder"],
        body: { amount: "150.00" },
        idempotencyKey
      });

      const secondRes = await BiddingService.placeBid({
        auctionId,
        bidderId: user.id,
        roles: ["bidder"],
        body: { amount: "150.00" },
        idempotencyKey
      });

      expect(firstRes.bid.id).toBe(secondRes.bid.id);
      
      const bidCountRes = await pool.query("SELECT COUNT(*) FROM bids WHERE auction_id = $1", [auctionId]);
      expect(Number(bidCountRes.rows[0].count)).toBe(1);
    });
  });
});
