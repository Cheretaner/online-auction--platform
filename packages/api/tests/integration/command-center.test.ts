import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { env } from "../../src/config/env.js";
import {
  addMember,
  api,
  createAuction,
  createOrg,
  createUser,
  startTestApp,
  type TestContext,
} from "./helpers.js";

const databaseUrl = env.DATABASE_URL;

describe.skipIf(!databaseUrl)("operational exception command center (real Postgres)", () => {
  let ctx: TestContext;
  let orgId: string;
  let otherOrgId: string;
  let officerId: string;
  let bidderId: string;
  let token: string;
  let auctionId: string;
  let otherAuctionId: string;

  beforeAll(async () => {
    ctx = await startTestApp();
    orgId = await createOrg(ctx);
    otherOrgId = await createOrg(ctx);
    officerId = await createUser(ctx, { verified: true });
    bidderId = await createUser(ctx, { verified: true });
    await addMember(ctx, orgId, officerId, "compliance_officer");
    await addMember(ctx, orgId, bidderId, "bidder");
    token = ctx.sign(officerId, ["compliance_officer"], orgId);
    auctionId = await createAuction(ctx, { orgId, createdBy: officerId, status: "live" });
    otherAuctionId = await createAuction(ctx, { orgId: otherOrgId, createdBy: officerId, status: "live" });
  }, 60_000);

  afterAll(async () => {
    await ctx?.close();
  });

  it("returns organization-scoped, prioritized exceptions with exact review routes", async () => {
    const verificationId = randomUUID();
    const depositId = randomUUID();
    const disputeId = randomUUID();
    const anomalyId = randomUUID();

    await ctx.pool.query(
      `INSERT INTO verifications (id, user_id, document_type, document_number, status)
       VALUES ($1, $2, 'national_id', 'local-verification', 'pending')`,
      [verificationId, bidderId],
    );
    await ctx.pool.query(
      `INSERT INTO deposits (id, auction_id, bidder_id, amount, reference_number, issuing_bank, instrument_type, status)
       VALUES ($1, $2, $3, 10, 'local-deposit', 'Commercial Bank of Ethiopia', 'cpo', 'pending')`,
      [depositId, auctionId, bidderId],
    );
    await ctx.pool.query(
      `INSERT INTO disputes (id, auction_id, raised_by, status, reason)
       VALUES ($1, $2, $3, 'open', 'Local dispute')`,
      [disputeId, auctionId, bidderId],
    );
    await ctx.pool.query(
      `INSERT INTO anomaly_flags (id, auction_id, subject_accounts, score, severity, status)
       VALUES ($1, $2, ARRAY[$3::uuid], 90, 'high', 'open')`,
      [anomalyId, auctionId, bidderId],
    );

    const response = await api(ctx, "GET", "/api/v1/operations/exceptions", { token });
    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(4);

    const items = response.body.items as Array<{ id: string; actionPath: string }>;
    const byId = new Map(items.map((item) => [item.id, item]));
    expect(byId.get(verificationId)?.actionPath).toBe(`/app/kyc/review?recordId=${verificationId}`);
    expect(byId.get(depositId)?.actionPath).toBe(`/app/auctions/${auctionId}?recordId=${depositId}&source=deposit`);
    expect(byId.get(disputeId)?.actionPath).toBe(`/app/disputes?recordId=${disputeId}&source=dispute`);
    expect(byId.get(anomalyId)?.actionPath).toBe(`/app/ai?flagId=${anomalyId}`);

    const otherOrgResponse = await api(ctx, "GET", "/api/v1/operations/exceptions", {
      token: ctx.sign(officerId, ["compliance_officer"], otherOrgId),
    });
    expect(otherOrgResponse.status).toBe(200);
    expect(otherOrgResponse.body.items).toHaveLength(0);

    const foreignDepositId = randomUUID();
    await ctx.pool.query(
      `INSERT INTO deposits (id, auction_id, bidder_id, amount, reference_number, issuing_bank, instrument_type, status)
       VALUES ($1, $2, $3, 10, 'foreign-deposit', 'Commercial Bank of Ethiopia', 'cpo', 'pending')`,
      [foreignDepositId, otherAuctionId, bidderId],
    );
    const localOnly = await api(ctx, "GET", "/api/v1/operations/exceptions", { token });
    expect(localOnly.body.items.map((item: { id: string }) => item.id)).not.toContain(foreignDepositId);
  }, 30_000);
});
