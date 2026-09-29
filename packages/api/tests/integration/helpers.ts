import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import type pg from "pg";

/**
 * Integration tests run only when TEST_DATABASE_URL points at a disposable
 * Postgres database. They are skipped otherwise, so `pnpm test` still works
 * on a laptop without a database. CI provides one (see .github/workflows/ci.yml).
 */
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

if (TEST_DATABASE_URL) {
  // config/env.ts reads process.env once at import time, so these must be set
  // before anything from src/ is imported.
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.NODE_ENV = "test";
  process.env.LOG_LEVEL = "error";
  process.env.RATE_LIMIT_MAX = "100000";
  process.env.AUTH_RATE_LIMIT_MAX = "100000";
  process.env.BOOTSTRAP_SUPER_ADMIN_EMAIL = "bootstrap.admin@example.test";
  process.env.AI_PROVIDER = "stub";
}

export interface TestContext {
  baseUrl: string;
  pool: pg.Pool;
  sign: (userId: string, roles: string[], organizationId?: string) => string;
  close: () => Promise<void>;
}

export async function startTestApp(): Promise<TestContext> {
  const { runMigrations } = await import("../../src/infrastructure/database/migrations/run.js");
  const { createApp } = await import("../../src/app.js");
  const { getPool, closePool } = await import("../../src/infrastructure/database/pool.js");
  const { signAccessToken } = await import("../../src/infrastructure/auth/jwt.js");

  await runMigrations();
  const app = createApp();
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const { port } = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    pool: getPool(),
    sign: (userId, roles, organizationId) =>
      signAccessToken({ sub: userId, roles: roles as never, organizationId }),
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await closePool();
    },
  };
}

export async function api(
  ctx: TestContext,
  method: string,
  path: string,
  options: { token?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<{ status: number; body: any }> {
  const headers: Record<string, string> = { ...options.headers };
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  if (options.body !== undefined) headers["content-type"] = "application/json";
  const response = await fetch(`${ctx.baseUrl}${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // leave as text
  }
  return { status: response.status, body };
}

export async function createUser(
  ctx: TestContext,
  options: { verified?: boolean; platformRole?: "super_admin" } = {},
): Promise<string> {
  const id = randomUUID();
  await ctx.pool.query(
    `INSERT INTO profiles (id, email, full_name, password_hash, verification_status, platform_role)
     VALUES ($1, $2, $3, 'not-a-real-hash', $4, $5)`,
    [id, `${id}@example.test`, `User ${id.slice(0, 8)}`, options.verified ? "verified" : "unverified", options.platformRole ?? null],
  );
  return id;
}

export async function createOrg(ctx: TestContext): Promise<string> {
  const id = randomUUID();
  await ctx.pool.query(
    `INSERT INTO organizations (id, name, slug, org_type, taxpayer_id) VALUES ($1, $2, $3, 'government', $4)`,
    [id, `Org ${id.slice(0, 8)}`, `org-${id}`, id.slice(0, 10)],
  );
  return id;
}

export async function addMember(ctx: TestContext, orgId: string, userId: string, role: string): Promise<void> {
  await ctx.pool.query(
    `INSERT INTO organization_members (organization_id, user_id, role) VALUES ($1, $2, $3)`,
    [orgId, userId, role],
  );
}

export async function createAuction(
  ctx: TestContext,
  options: {
    orgId: string;
    createdBy: string;
    status: "draft" | "live" | "scheduled";
    startPrice?: string;
    minIncrement?: string;
    depositAmount?: string;
  },
): Promise<string> {
  const id = randomUUID();
  const opensAt = new Date(Date.now() - 60_000);
  const closesAt = new Date(Date.now() + 60 * 60_000);
  await ctx.pool.query(
    `INSERT INTO auctions (id, org_id, title, auction_type, status, start_price, min_increment, deposit_amount,
                           opens_at, closes_at, original_closes_at, created_by)
     VALUES ($1, $2, $3, 'open_ascending', $4, $5, $6, $7, $8, $9, $9, $10)`,
    [
      id,
      options.orgId,
      `Auction ${id.slice(0, 8)}`,
      options.status,
      options.startPrice ?? "1000.00",
      options.minIncrement ?? "100.00",
      options.depositAmount ?? "0.00",
      opensAt,
      closesAt,
      options.createdBy,
    ],
  );
  return id;
}

export async function createVerifiedDeposit(
  ctx: TestContext,
  auctionId: string,
  bidderId: string,
  amount: string,
  verifiedBy: string,
): Promise<void> {
  await ctx.pool.query(
    `INSERT INTO deposits (auction_id, bidder_id, amount, reference_number, issuing_bank, instrument_type,
                           status, verified_by, verified_at)
     VALUES ($1, $2, $3, $4, 'Commercial Bank of Ethiopia', 'cpo', 'verified', $5, now())`,
    [auctionId, bidderId, amount, `REF-${randomUUID().slice(0, 8)}`, verifiedBy],
  );
}

export function bid(ctx: TestContext, auctionId: string, token: string, amount: string, key = randomUUID()) {
  return api(ctx, "POST", `/api/v1/auctions/${auctionId}/bids`, {
    token,
    body: { amount },
    headers: { "Idempotency-Key": key },
  });
}
