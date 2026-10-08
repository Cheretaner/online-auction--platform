import type { Role } from "@auction/shared";
import type { PublicProfile } from "./identity.types.js";
import { queryOne, queryAll } from "../infrastructure/database/query.js";
import type { Queryable } from "../infrastructure/database/query.js";
import { withTransaction } from "../infrastructure/database/tx.js";
import { mapDbRole } from "../kernel/roles.js";
import { decryptSensitive, encryptSensitive, hashSensitive } from "../shared/security/sensitive-data.js";
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
  national_id_hash: string | null;
  tin_number_hash: string | null;
  region: string | null;
  preferred_language: "en" | "am" | null;
  verification_status: Profile["verificationStatus"];
  platform_role: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

interface DbAdminUser extends Omit<DbProfile, "password_hash" | "national_id" | "tin_number" | "national_id_hash" | "tin_number_hash"> {
  roles: string[];
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
    nationalId: decryptSensitive(row.national_id),
    tinNumber: decryptSensitive(row.tin_number),
    region: row.region,
    preferredLanguage: row.preferred_language,
    verificationStatus: row.verification_status,
    platformRole: row.platform_role ? mapDbRole(row.platform_role) : null,
    isActive: row.is_active,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export class IdentityRepository {
  async findProfileByGoogleSubject(subject: string): Promise<Profile | null> {
    const row = await queryOne<DbProfile>(
      `SELECT * FROM profiles WHERE google_subject = $1 AND is_active = TRUE`,
      [subject],
    );
    return row ? mapProfile(row) : null;
  }

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
    googleSubject?: string;
  }): Promise<Profile> {
    return withTransaction(async (client) => {
      const row = await queryOne<DbProfile>(
        `INSERT INTO profiles (
           email, full_name, password_hash, phone, account_type,
           business_name, national_id, tin_number, national_id_hash, tin_number_hash, region, platform_role, google_subject
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING *`,
        [
          data.email,
          data.fullName,
          data.passwordHash,
          data.phone ?? null,
          data.accountType,
          data.businessName ?? null,
          encryptSensitive(data.nationalId),
          encryptSensitive(data.tinNumber),
          hashSensitive(data.nationalId),
          hashSensitive(data.tinNumber),
          data.region ?? null,
          data.platformRole ?? null,
          data.googleSubject ?? null,
        ],
        client,
      );
      if (!row) throw new Error("Failed to create profile");
      return mapProfile(row);
    });
  }

  async linkGoogleSubject(userId: string, subject: string): Promise<Profile | null> {
    const row = await queryOne<DbProfile>(
      `UPDATE profiles
          SET google_subject = $2, updated_at = NOW()
        WHERE id = $1 AND is_active = TRUE
          AND (google_subject IS NULL OR google_subject = $2)
        RETURNING *`,
      [userId, subject],
    );
    return row ? mapProfile(row) : null;
  }

  async updateProfile(
    id: string,
    data: { fullName?: string; phone?: string; region?: string; preferredLanguage?: "en" | "am" },
  ): Promise<Profile | null> {
    return withTransaction(async (client) => {
      const row = await queryOne<DbProfile>(
        `UPDATE profiles SET
           full_name = COALESCE($2, full_name),
           phone     = COALESCE($3, phone),
           region    = COALESCE($4, region),
           preferred_language = COALESCE($5, preferred_language),
           updated_at = NOW()
         WHERE id = $1 AND is_active = TRUE
         RETURNING *`,
        [id, data.fullName ?? null, data.phone ?? null, data.region ?? null, data.preferredLanguage ?? null],
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

  async listAdminUsers(): Promise<Array<PublicProfile & { roles: Role[] }>> {
    const rows = await queryAll<DbAdminUser>(
      `SELECT p.id, p.email, p.full_name, p.phone, p.account_type, p.business_name,
              p.region, p.preferred_language, p.verification_status, p.platform_role,
              p.is_active, p.created_at, p.updated_at,
              COALESCE(
                array_agg(DISTINCT user_roles.role) FILTER (WHERE user_roles.role IS NOT NULL),
                ARRAY['bidder']::text[]
              ) AS roles
         FROM profiles p
         LEFT JOIN LATERAL (
           SELECT om.role
             FROM organization_members om
            WHERE om.user_id = p.id
           UNION
           SELECT p.platform_role
            WHERE p.platform_role IS NOT NULL
         ) AS user_roles ON TRUE
        WHERE p.is_active = TRUE
        GROUP BY p.id
        ORDER BY p.created_at DESC`,
    );
    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      fullName: row.full_name,
      phone: row.phone,
      accountType: row.account_type,
      businessName: row.business_name,
      region: row.region,
      preferredLanguage: row.preferred_language,
      verificationStatus: row.verification_status,
      platformRole: row.platform_role ? mapDbRole(row.platform_role) : null,
      isActive: row.is_active,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
      roles: [...new Set(row.roles.map(mapDbRole))],
    }));
  }

  async updatePlatformProfile(
    id: string,
    data: { fullName?: string; isActive?: boolean; platformRole?: Role | null },
  ): Promise<Profile | null> {
    const assignments: { field: string; value: unknown }[] = [];
    if (data.fullName !== undefined) assignments.push({ field: "full_name", value: data.fullName });
    if (data.isActive !== undefined) assignments.push({ field: "is_active", value: data.isActive });
    if (data.platformRole !== undefined) assignments.push({ field: "platform_role", value: data.platformRole });
    if (assignments.length === 0) return this.findProfileById(id);
    const values = [id, ...assignments.map((assignment) => assignment.value)];
    const row = await queryOne<DbProfile>(
      `UPDATE profiles SET ${assignments.map((assignment, index) => `${assignment.field} = $${index + 2}`).join(", ")}, updated_at = NOW()
       WHERE id = $1 AND is_active = TRUE
       RETURNING *`,
      values,
    );
    return row ? mapProfile(row) : null;
  }

  async deactivateProfile(id: string): Promise<void> {
    await queryOne(
      `UPDATE profiles SET is_active = FALSE, updated_at = NOW() WHERE id = $1 RETURNING id`,
      [id],
    );
  }

  async countSuperAdmins(): Promise<number> {
    const row = await queryOne<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM profiles WHERE platform_role = 'super_admin' AND is_active = TRUE`,
    );
    return Number(row?.count ?? 0);
  }

  async countProfiles(): Promise<number> {
    const row = await queryOne<{ count: string }>(`SELECT COUNT(*)::text AS count FROM profiles`);
    return Number(row?.count ?? 0);
  }
}
