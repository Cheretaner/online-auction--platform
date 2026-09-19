import { queryOne, queryAll } from "../infrastructure/database/query.js";
import { withTransaction } from "../infrastructure/database/tx.js";
import type { Profile, OrganizationMember } from "./identity.types.js";

export class IdentityRepository {
  async findProfileByEmail(email: string): Promise<Profile | null> {
    const row = await queryOne(
      `SELECT * FROM profiles WHERE email = $1 AND is_active = true`,
      [email]
    );
    return row ? this.mapProfile(row) : null;
  }

  async findProfileById(id: string): Promise<Profile | null> {
    const row = await queryOne(
      `SELECT * FROM profiles WHERE id = $1 AND is_active = true`,
      [id]
    );
    return row ? this.mapProfile(row) : null;
  }

  async createProfile(data: Partial<Profile>): Promise<Profile> {
    return await withTransaction(null, async (client) => {
      const row = await queryOne(
        `INSERT INTO profiles (
          email, full_name, password_hash, phone, account_type,
          business_name, national_id, tin_number, region
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
        [
          data.email, data.fullName, data.passwordHash, data.phone, data.accountType,
          data.businessName, data.nationalId, data.tinNumber, data.region
        ],
        client
      );
      if (!row) throw new Error("Failed to create profile");
      return this.mapProfile(row);
    });
  }

  async updateProfile(id: string, data: Partial<Profile>): Promise<Profile> {
    return await withTransaction(id, async (client) => {
      const row = await queryOne(
        `UPDATE profiles SET
          full_name = COALESCE($2, full_name),
          phone = COALESCE($3, phone),
          business_name = COALESCE($4, business_name),
          region = COALESCE($5, region),
          updated_at = NOW()
        WHERE id = $1 AND is_active = true
        RETURNING *`,
        [id, data.fullName, data.phone, data.businessName, data.region],
        client
      );
      if (!row) throw new Error("Failed to update profile");
      return this.mapProfile(row);
    });
  }

  async findUserRoles(userId: string): Promise<string[]> {
    const rows = await queryAll(
      `SELECT role FROM organization_members WHERE user_id = $1`,
      [userId]
    );
    const roles = rows.map((r: any) => r.role);
    return roles.length > 0 ? roles : ['bidder'];
  }

  private mapProfile(row: any): Profile {
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
      isActive: row.is_active,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString()
    };
  }
}
