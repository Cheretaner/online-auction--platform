import { beforeAll, afterAll } from "vitest";
import { getPool, closePool } from "../infrastructure/database/pool.js";
import { runMigrations } from "../infrastructure/database/migrations/run.js";
import { signAccessToken, signRefreshToken } from "../infrastructure/auth/jwt.js";
import type { Role } from "@auction/shared";
import bcrypt from "bcryptjs";

beforeAll(async () => {
  await runMigrations();
});

afterAll(async () => {
  await closePool();
});

export async function createTestUser(
  role: Role = "bidder",
  verificationStatus: "verified" | "unverified" | "pending" | "rejected" = "verified",
) {
  const pool = getPool();
  const id = crypto.randomUUID();
  const email = `test-${id}@example.com`;
  const passwordHash = await bcrypt.hash("TestPassword1!", 4); // low rounds for speed
  await pool.query(
    `INSERT INTO profiles (id, email, full_name, password_hash, verification_status)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, email, "Test User", passwordHash, verificationStatus],
  );
  return { id, email, password: "TestPassword1!", role, verificationStatus };
}

export async function createTestOrg(creatorId?: string) {
  const pool = getPool();
  const id = crypto.randomUUID();
  const name = `Org-${id.slice(0, 8)}`;
  const slug = `org-${id.slice(0, 8)}`;
  await pool.query(
    `INSERT INTO organizations (id, name, slug, created_by) VALUES ($1, $2, $3, $4)`,
    [id, name, slug, creatorId ?? id],
  );
  return { id, name, slug };
}

export async function addOrgMember(
  orgId: string,
  userId: string,
  role: "organization_admin" | "auction_officer" | "compliance_officer" = "auction_officer",
) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO organization_members (organization_id, user_id, role) VALUES ($1, $2, $3)`,
    [orgId, userId, role],
  );
}

export async function getAuthToken(userId: string, roles: Role[] = ["bidder"], orgId?: string) {
  const accessToken = signAccessToken({ sub: userId, roles, organizationId: orgId });
  const refreshToken = signRefreshToken(userId);
  return { accessToken, refreshToken };
}

export async function cleanupTestData() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      TRUNCATE TABLE profiles CASCADE;
      TRUNCATE TABLE organizations CASCADE;
      TRUNCATE TABLE auctions CASCADE;
    `);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
