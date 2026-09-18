import type { Role } from "@auction/shared";
import { query } from "../infrastructure/database/query.js";
import { mapDbRole } from "../kernel/roles.js";

export interface DbUser {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  verified: boolean;
}

export async function findUserByEmail(email: string): Promise<DbUser | null> {
  const result = await query<DbUser>("SELECT * FROM users WHERE email = $1 LIMIT 1", [email]);
  return result.rows[0] ?? null;
}

export async function createUser(
  email: string,
  passwordHash: string,
  displayName: string,
): Promise<DbUser> {
  const result = await query<DbUser>(
    `INSERT INTO users (email, password_hash, display_name)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [email, passwordHash, displayName],
  );
  return result.rows[0];
}

export async function getUserRoles(userId: string): Promise<Role[]> {
  const result = await query<{ role: string }>(
    "SELECT role FROM organization_members WHERE user_id = $1",
    [userId],
  );
  const roles = result.rows.map((row) => mapDbRole(row.role));
  return roles.length ? [...new Set(roles)] : ["bidder"];
}
