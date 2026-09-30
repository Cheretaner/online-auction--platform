import type { Role } from "@auction/shared";
import { queryOne, queryAll } from "../infrastructure/database/query.js";
import type { Queryable } from "../infrastructure/database/query.js";
import { withTransaction } from "../infrastructure/database/tx.js";
import { mapDbRole } from "../kernel/roles.js";
import type { OrganizationMembership, Profile } from "./identity.types.js";

interface DbProfile {
  id: string;
  email: string;
  full_name: string;
  password_hash: string;
  phone: string | null;
  account_type: Profile["accountType"];
  business_name: string | null;
  national_id: string | null;
  tin_number: string | null;
  region: string | null;
  verification_status: Profile["verificationStatus"];
  platform_role: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

function mapProfile(row: DbProfile): Profile {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    passwordHash: row.password_hash,
    phone: row.phone,
    accountType: row.account_type,
    businessName: row.business_name,
    nationalId: row.national_id,
    tinNumber: row.tin_number,
    region: row.region,
    verificationStatus: row.verification_status,
    platformRole: row.platform_role ? mapDbRole(row.platform_role) : null,
    isActive: row.is_active,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export class IdentityRepository {
  async findProfileByEmail(email: string): Promise<Profile | null> {
    const row = await queryOne<DbProfile>(
      `SELECT * FROM profiles WHERE lower(email) = lower($1) AND is_active = TRUE`,
      [email],
    );
    return row ? mapProfile(row) : null;
  }

  async findProfileById(id: string, client?: Queryable): Promise<Profile | null> {
    const row = await queryOne<DbProfile>(
      `SELECT * FROM profiles WHERE id = $1 AND is_active = TRUE`,
      [id],
      client,
    );
    return row ? mapProfile(row) : null;
  }

  async createProfile(data: {
    email: string;
    fullName: string;
    passwordHash: string;
    phone?: string;
    accountType: Profile["accountType"];
    businessName?: string;
    nationalId?: string;
    tinNumber?: string;
    region?: string;
    platformRole?: Role | null;
  }): Promise<Profile> {
    return withTransaction(async (client) => {
      const row = await queryOne<DbProfile>(
        `INSERT INTO profiles (
           email, full_name, password_hash, phone, account_type,
           business_name, national_id, tin_number, region, platform_role
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          data.email,
          data.fullName,
          data.passwordHash,
          data.phone ?? null,
          data.accountType,
          data.businessName ?? null,
          data.nationalId ?? null,
          data.tinNumber ?? null,
          data.region ?? null,
          data.platformRole ?? null,
        ],
        client,
      );
      if (!row) throw new Error("Failed to create profile");
      return mapProfile(row);
    });
  }

  async updateProfile(
    id: string,
    data: { fullName?: string; phone?: string; region?: string },
  ): Promise<Profile | null> {
    return withTransaction(async (client) => {
      const row = await queryOne<DbProfile>(
        `UPDATE profiles SET
           full_name = COALESCE($2, full_name),
           phone     = COALESCE($3, phone),
           region    = COALESCE($4, region),
           updated_at = NOW()
         WHERE id = $1 AND is_active = TRUE
         RETURNING *`,
        [id, data.fullName ?? null, data.phone ?? null, data.region ?? null],
        client,
      );
      return row ? mapProfile(row) : null;
    }, { userId: id });
  }

  /**
   * Every role the user holds: organization memberships plus any
   * platform-level role. Falls back to `bidder` so a freshly registered
   * account can still browse and bid.
   */
  async findUserRoles(userId: string): Promise<Role[]> {
    const rows = await queryAll<{ role: string }>(
      `SELECT role FROM organization_members WHERE user_id = $1
        UNION
       SELECT platform_role AS role FROM profiles
        WHERE id = $1 AND platform_role IS NOT NULL`,
      [userId],
    );
    const roles = [...new Set(rows.map((row) => mapDbRole(row.role)))];
    return roles.length > 0 ? roles : ["bidder"];
  }

  async findMemberships(userId: string): Promise<OrganizationMembership[]> {
    const rows = await queryAll<{ organization_id: string; name: string; role: string }>(
      `SELECT om.organization_id, o.name, om.role
         FROM organization_members om
         JOIN organizations o ON o.id = om.organization_id
        WHERE om.user_id = $1
        ORDER BY o.name ASC`,
      [userId],
    );
    return rows.map((row) => ({
      organizationId: row.organization_id,
      organizationName: row.name,
      role: mapDbRole(row.role),
    }));
  }

  async isMemberOf(userId: string, organizationId: string): Promise<boolean> {
    const row = await queryOne<{ ok: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM organization_members
          WHERE user_id = $1 AND organization_id = $2
       ) AS ok`,
      [userId, organizationId],
    );
    return Boolean(row?.ok);
  }

  async updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
    await queryOne(`UPDATE profiles SET password_hash = $2, updated_at = now() WHERE id = $1 RETURNING id`, [
      userId,
      passwordHash,
    ]);
  }

  async countProfiles(): Promise<number> {
    const row = await queryOne<{ count: string }>(`SELECT COUNT(*)::text AS count FROM profiles`);
    return Number(row?.count ?? 0);
  }
}
