import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  TEST_DATABASE_URL,
  addMember,
  api,
  createAuction,
  createOrg,
  createUser,
  startTestApp,
  type TestContext,
} from "./helpers.js";

/**
 * An officer role proves only that someone is an officer somewhere. These
 * tests pin down that officers of one organization cannot act on another
 * organization's deposits, disputes or anomaly flags.
 */
describe.skipIf(!TEST_DATABASE_URL)("organization boundaries (real Postgres)", () => {
  let ctx: TestContext;
  let orgA: string;
  let officerA: string;
  let tokenA: string;
  let tokenB: string;
  let auctionA: string;
  let bidderId: string;
  let bidderToken: string;

  beforeAll(async () => {
    ctx = await startTestApp();
    orgA = await createOrg(ctx);
    const orgB = await createOrg(ctx);
    officerA = await createUser(ctx, { verified: true });
    const officerB = await createUser(ctx, { verified: true });
    await addMember(ctx, orgA, officerA, "compliance_officer");
    await addMember(ctx, orgB, officerB, "compliance_officer");
    tokenA = ctx.sign(officerA, ["compliance_officer"], orgA);
    tokenB = ctx.sign(officerB, ["compliance_officer"], orgB);
    auctionA = await createAuction(ctx, { orgId: orgA, createdBy: officerA, status: "live", depositAmount: "100.00" });
    bidderId = await createUser(ctx, { verified: true });
    bidderToken = ctx.sign(bidderId, ["bidder"]);
  }, 60_000);

  afterAll(async () => {
    await ctx?.close();
  });

  it("lets only the auction's own organization review a deposit", async () => {
    const created = await api(ctx, "POST", "/api/v1/deposits", {
      token: bidderToken,
      body: {
        auctionId: auctionA,
        amount: "100.00",
        referenceNumber: `CPO-${randomUUID().slice(0, 6)}`,
        issuingBank: "Commercial Bank of Ethiopia",
        instrumentType: "cpo",
      },
    });
    expect(created.status).toBe(201);
    const depositId = created.body.id;

    const foreign = await api(ctx, "POST", `/api/v1/deposits/${depositId}/review`, {
      token: tokenB,
      body: { decision: "verified" },
    });
    expect(foreign.status).toBe(403);
    expect((await api(ctx, "GET", `/api/v1/deposits/${depositId}`, { token: tokenB })).status).toBe(403);

    const own = await api(ctx, "POST", `/api/v1/deposits/${depositId}/review`, {
      token: tokenA,
      body: { decision: "verified" },
    });
    expect(own.status).toBe(200);
    expect(own.body.status).toBe("verified");
  });

  it("keeps outsider uploads private and limits them to the auction's organization", async () => {
    const form = new FormData();
    form.set("file", new Blob(["CPO scan"], { type: "text/plain" }), "cpo.txt");
    form.set("docType", "other");
    form.set("auctionId", auctionA);
    form.set("isPrivate", "false");
    const res = await fetch(`${ctx.baseUrl}/api/v1/documents`, {
      method: "POST",
      headers: { authorization: `Bearer ${bidderToken}` },
      body: form,
    });
    expect(res.status).toBe(201);
    const doc = (await res.json()) as { id: string; isPrivate: boolean };
    expect(doc.isPrivate).toBe(true);

    expect((await api(ctx, "GET", `/api/v1/documents/${doc.id}`, { token: tokenB })).status).toBe(403);
    expect((await api(ctx, "GET", `/api/v1/documents/${doc.id}`, { token: tokenA })).status).toBe(200);
    expect((await api(ctx, "GET", `/api/v1/documents/${doc.id}`, { token: bidderToken })).status).toBe(200);
  });

  it("keeps disputes inside the organization that runs the auction", async () => {
    const opened = await api(ctx, "POST", "/api/v1/disputes", {
      token: bidderToken,
      body: { auctionId: auctionA, reason: "The closing time moved without notice to bidders." },
    });
    expect(opened.status).toBe(201);
    const disputeId = opened.body.id;

    const listB = await api(ctx, "GET", "/api/v1/disputes", { token: tokenB });
    expect(listB.body.items.map((d: { id: string }) => d.id)).not.toContain(disputeId);
    expect((await api(ctx, "GET", `/api/v1/disputes/${disputeId}`, { token: tokenB })).status).toBe(403);
    expect(
      (await api(ctx, "POST", `/api/v1/disputes/${disputeId}/assign`, { token: tokenB, body: { reviewerId: officerA } })).status,
    ).toBe(403);

    const listA = await api(ctx, "GET", "/api/v1/disputes", { token: tokenA });
    expect(listA.body.items.map((d: { id: string }) => d.id)).toContain(disputeId);
  });

  it("lets only participants raise disputes and never freezes a live auction", async () => {
    const live = await createAuction(ctx, { orgId: orgA, createdBy: officerA, status: "live" });
    const outsiderId = await createUser(ctx, { verified: true });
    const outsider = ctx.sign(outsiderId, ["bidder"]);
    const refused = await api(ctx, "POST", "/api/v1/disputes", {
      token: outsider,
      body: { auctionId: live, reason: "I never took part but want to stop this auction." },
    });
    expect(refused.status).toBe(403);

    const bid = await api(ctx, "POST", `/api/v1/auctions/${live}/bids`, {
      token: bidderToken,
      body: { amount: "1000.00" },
      headers: { "Idempotency-Key": randomUUID() },
    });
    expect(bid.status).toBe(201);
    const opened = await api(ctx, "POST", "/api/v1/disputes", {
      token: bidderToken,
      body: { auctionId: live, reason: "The increment shown differs from the tender notice." },
    });
    expect(opened.status).toBe(201);
    const { rows } = await ctx.pool.query(`SELECT status FROM auctions WHERE id = $1`, [live]);
    expect(rows[0].status).toBe("live");
  });

  it("scopes anomaly flags, audits reviews and blocks award while a high flag is open", async () => {
    const closed = await createAuction(ctx, { orgId: orgA, createdBy: officerA, status: "live" });
    await ctx.pool.query(`UPDATE auctions SET status = 'under_review' WHERE id = $1`, [closed]);
    const { rows } = await ctx.pool.query(
      `INSERT INTO anomaly_flags (auction_id, subject_accounts, score, severity, status)
       VALUES ($1, ARRAY[$2::uuid], 85, 'high', 'open') RETURNING id`,
      [closed, bidderId],
    );
    const flagId = rows[0].id;

    const listB = await api(ctx, "GET", "/api/v1/ai/anomalies", { token: tokenB });
    expect(listB.body.items.map((f: { id: string }) => f.id)).not.toContain(flagId);
    expect(
      (await api(ctx, "POST", `/api/v1/ai/anomalies/${flagId}/review`, { token: tokenB, body: { status: "dismissed", decisionNote: "not ours" } }))
        .status,
    ).toBe(403);

    const approverId = await createUser(ctx, { verified: true });
    await addMember(ctx, orgA, approverId, "org_admin");
    const approver = ctx.sign(approverId, ["org_admin"], orgA);
    const blocked = await api(ctx, "PATCH", `/api/v1/auctions/${closed}/status`, { token: approver, body: { status: "awarded" } });
    expect(blocked.status).toBe(422);

    const review = await api(ctx, "POST", `/api/v1/ai/anomalies/${flagId}/review`, {
      token: tokenA,
      body: { status: "dismissed", decisionNote: "Bids came from separate verified firms." },
    });
    expect(review.status).toBe(200);
    const audit = await ctx.pool.query(`SELECT 1 FROM audit_events WHERE entity_id = $1 AND action = 'anomaly.reviewed'`, [flagId]);
    expect(audit.rowCount).toBe(1);

    const awarded = await api(ctx, "PATCH", `/api/v1/auctions/${closed}/status`, { token: approver, body: { status: "awarded" } });
    expect(awarded.status).toBe(200);
  });
});
