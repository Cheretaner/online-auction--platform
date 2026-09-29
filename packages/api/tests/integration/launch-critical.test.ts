import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  TEST_DATABASE_URL,
  addMember,
  api,
  bid,
  createAuction,
  createOrg,
  createUser,
  createVerifiedDeposit,
  startTestApp,
  type TestContext,
} from "./helpers.js";

describe.skipIf(!TEST_DATABASE_URL)("launch-critical paths (real Postgres)", () => {
  let ctx: TestContext;
  let orgId: string;
  let officerId: string;
  let officerToken: string;
  let approverId: string;
  let adminToken: string;

  beforeAll(async () => {
    ctx = await startTestApp();
    orgId = await createOrg(ctx);
    officerId = await createUser(ctx, { verified: true });
    approverId = await createUser(ctx, { verified: true });
    await addMember(ctx, orgId, officerId, "auction_officer");
    await addMember(ctx, orgId, approverId, "org_admin");
    officerToken = ctx.sign(officerId, ["auction_officer"], orgId);
    const adminId = await createUser(ctx, { platformRole: "super_admin" });
    adminToken = ctx.sign(adminId, ["super_admin"]);
  }, 60_000);

  afterAll(async () => {
    await ctx?.close();
  });

  async function newBidder(options: { verified?: boolean } = { verified: true }) {
    const id = await createUser(ctx, options);
    return { id, token: ctx.sign(id, ["bidder"]) };
  }

  describe("registration", () => {
    it("does not grant super_admin based on the shape of the email address", async () => {
      const res = await api(ctx, "POST", "/api/v1/auth/register", {
        body: {
          email: `admin.${randomUUID().slice(0, 8)}@cheretanet.org`,
          password: "a-long-password-123",
          fullName: "Not An Admin",
        },
      });
      expect(res.status).toBe(201);
      expect(res.body.roles).not.toContain("super_admin");
    });

    it("grants super_admin only to the configured bootstrap address", async () => {
      await ctx.pool.query(`DELETE FROM profiles WHERE email = 'bootstrap.admin@example.test'`);
      const res = await api(ctx, "POST", "/api/v1/auth/register", {
        body: { email: "bootstrap.admin@example.test", password: "a-long-password-123", fullName: "Root" },
      });
      expect(res.status).toBe(201);
      expect(res.body.roles).toContain("super_admin");
    });
  });

  describe("auction visibility", () => {
    it("hides a draft auction and its lots from outsiders but not from its officers", async () => {
      const draftId = await createAuction(ctx, { orgId, createdBy: officerId, status: "draft" });
      const outsider = await newBidder();

      expect((await api(ctx, "GET", `/api/v1/auctions/${draftId}`)).status).toBe(404);
      expect((await api(ctx, "GET", `/api/v1/auctions/${draftId}`, { token: outsider.token })).status).toBe(404);
      expect((await api(ctx, "GET", `/api/v1/auctions/${draftId}/items`)).status).toBe(404);
      expect((await api(ctx, "GET", `/api/v1/auctions/${draftId}`, { token: officerToken })).status).toBe(200);
    });
  });

  describe("live-event stream authorization", () => {
    async function subscribe(channel: string | null, token: string) {
      const controller = new AbortController();
      const query = channel === null ? "" : `?channel=${encodeURIComponent(channel)}`;
      const res = await fetch(`${ctx.baseUrl}/api/v1/events${query}`, {
        headers: { authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      controller.abort();
      return res.status;
    }

    it("rejects the wildcard, missing and unknown channels", async () => {
      const { token } = await newBidder();
      expect(await subscribe(null, token)).toBe(400);
      expect(await subscribe("*", token)).toBe(400);
      expect(await subscribe(`notification:${randomUUID()}`, token)).toBe(400);
    });

    it("allows only the caller's own personal channel", async () => {
      const me = await newBidder();
      expect(await subscribe(`user:${me.id}`, me.token)).toBe(200);
      expect(await subscribe(`user:${randomUUID()}`, me.token)).toBe(403);
    });

    it("allows public auctions and refuses unpublished ones to outsiders", async () => {
      const outsider = await newBidder();
      const liveId = await createAuction(ctx, { orgId, createdBy: officerId, status: "live" });
      const draftId = await createAuction(ctx, { orgId, createdBy: officerId, status: "draft" });
      expect(await subscribe(`auction:${liveId}`, outsider.token)).toBe(200);
      expect(await subscribe(`auction:${draftId}`, outsider.token)).toBe(404);
      expect(await subscribe(`auction:${draftId}`, officerToken)).toBe(200);
    });

    it("strips identities and staff-only events for outside viewers", async () => {
      const { authorizeEventChannel } = await import("../../src/auction/auction-events.js");
      const outsider = await newBidder();
      const liveId = await createAuction(ctx, { orgId, createdBy: officerId, status: "live" });

      const publicAccess = await authorizeEventChannel(`auction:${liveId}`, { userId: outsider.id, roles: ["bidder"] });
      const staffAccess = await authorizeEventChannel(`auction:${liveId}`, {
        userId: officerId,
        roles: ["auction_officer"],
        organizationId: orgId,
      });
      if (!publicAccess.allowed || !staffAccess.allowed) throw new Error("expected access");

      const bidEvent = { channel: `auction:${liveId}`, event: "bid.placed", payload: { bidderId: "x", amount: "1.00" } };
      const anomaly = { channel: `auction:${liveId}`, event: "anomaly.flagged", payload: { score: 90 } };

      expect(publicAccess.filter(bidEvent)?.payload).toEqual({ amount: "1.00" });
      expect(publicAccess.filter(anomaly)).toBeNull();
      expect(staffAccess.filter(bidEvent)).toEqual(bidEvent);
      expect(staffAccess.filter(anomaly)).toEqual(anomaly);
    });
  });

  describe("bid eligibility", () => {
    it("rejects unverified bidders, missing deposits and self-bidding", async () => {
      const liveId = await createAuction(ctx, { orgId, createdBy: officerId, status: "live", depositAmount: "500.00" });
      const unverified = await newBidder({ verified: false });
      const noDeposit = await newBidder();

      const r1 = await bid(ctx, liveId, unverified.token, "1000.00");
      expect(r1.status).toBe(422);
      expect(r1.body.error.code).toBe("NOT_VERIFIED");

      const r2 = await bid(ctx, liveId, noDeposit.token, "1000.00");
      expect(r2.status).toBe(422);
      expect(r2.body.error.code).toBe("DEPOSIT_REQUIRED");

      const officerAsBidder = ctx.sign(officerId, ["bidder"]);
      const r3 = await bid(ctx, liveId, officerAsBidder, "1000.00");
      expect(r3.status).toBe(422);
      expect(r3.body.error.code).toBe("SELF_BIDDING");
    });

    it("forbids a bidder from approving an auction", async () => {
      const draftId = await createAuction(ctx, { orgId, createdBy: officerId, status: "draft" });
      const bidder = await newBidder();
      const res = await api(ctx, "POST", `/api/v1/auctions/${draftId}/approve`, { token: bidder.token });
      expect(res.status).toBe(403);
    });
  });

  describe("bid concurrency", () => {
    it("serializes 20 simultaneous bids at increasing amounts without losing or double-counting any", async () => {
      const liveId = await createAuction(ctx, { orgId, createdBy: officerId, status: "live", startPrice: "1000.00", minIncrement: "10.00" });
      const bidders = await Promise.all(Array.from({ length: 20 }, () => newBidder()));
      const amounts = bidders.map((_, i) => (1000 + i * 10).toFixed(2));

      const results = await Promise.all(bidders.map((b, i) => bid(ctx, liveId, b.token, amounts[i])));
      const accepted = results.filter((r) => r.status === 201);
      for (const r of results) {
        if (r.status !== 201) expect(r.body.error.code).toBe("BID_BELOW_MINIMUM");
      }

      const { rows } = await ctx.pool.query(
        `SELECT current_highest_bid, bid_count FROM auctions WHERE id = $1`,
        [liveId],
      );
      const bidRows = await ctx.pool.query(`SELECT amount FROM bids WHERE auction_id = $1`, [liveId]);

      expect(accepted.length).toBeGreaterThan(0);
      expect(bidRows.rowCount).toBe(accepted.length);
      expect(rows[0].bid_count).toBe(accepted.length);
      const maxAccepted = Math.max(...accepted.map((r) => Number(r.body.amount)));
      expect(Number(rows[0].current_highest_bid)).toBe(maxAccepted);
    });

    it("accepts exactly one of 10 simultaneous bids at the same opening amount", async () => {
      const liveId = await createAuction(ctx, { orgId, createdBy: officerId, status: "live", startPrice: "5000.00" });
      const bidders = await Promise.all(Array.from({ length: 10 }, () => newBidder()));
      const results = await Promise.all(bidders.map((b) => bid(ctx, liveId, b.token, "5000.00")));
      expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    });

    it("records one bid when the same idempotency key is sent twice at once", async () => {
      const liveId = await createAuction(ctx, { orgId, createdBy: officerId, status: "live" });
      const bidder = await newBidder();
      const key = randomUUID();
      const results = await Promise.all([
        bid(ctx, liveId, bidder.token, "1000.00", key),
        bid(ctx, liveId, bidder.token, "1000.00", key),
      ]);
      const { rowCount } = await ctx.pool.query(`SELECT 1 FROM bids WHERE auction_id = $1`, [liveId]);
      expect(rowCount).toBe(1);
      expect(results.some((r) => r.status === 201)).toBe(true);
    });

    it("keeps the audit chain intact after bidding", async () => {
      const liveId = await createAuction(ctx, { orgId, createdBy: officerId, status: "live", depositAmount: "100.00" });
      const bidders = await Promise.all(Array.from({ length: 5 }, () => newBidder()));
      for (const b of bidders) await createVerifiedDeposit(ctx, liveId, b.id, "100.00", approverId);
      await Promise.all(bidders.map((b, i) => bid(ctx, liveId, b.token, (1000 + i * 100).toFixed(2))));

      const res = await api(ctx, "GET", `/api/v1/audit/auctions/${liveId}/verify`, { token: adminToken });
      expect(res.status).toBe(200);
      expect(res.body.intact).toBe(true);
      expect(res.body.eventCount).toBeGreaterThan(0);
    });
  });
});
