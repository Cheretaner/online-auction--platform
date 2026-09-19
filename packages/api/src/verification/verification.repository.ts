import { queryOne, queryAll } from "../infrastructure/database/query.js";
import { withTransaction } from "../infrastructure/database/tx.js";
import type { Verification } from "./verification.types.js";

export class VerificationRepository {
  async createVerification(userId: string, data: { documentType: string; documentNumber: string }): Promise<Verification> {
    return await withTransaction(async (client) => {
      await queryOne(
        `UPDATE profiles SET verification_status = 'pending', updated_at = NOW() WHERE id = $1`,
        [userId],
        client
      );

      const row = await queryOne(
        `INSERT INTO verifications (user_id, document_type, document_number, status)
         VALUES ($1, $2, $3, 'pending')
         RETURNING *`,
        [userId, data.documentType, data.documentNumber],
        client
      );

      if (!row) throw new Error("Failed to create verification");
      return this.mapVerification(row);
    }, { userId });
  }

  async reviewVerification(adminId: string, verificationId: string, data: { status: 'verified' | 'rejected'; decision: 'approved' | 'rejected' | 'resubmission_required'; decisionReason?: string }): Promise<Verification> {
    return await withTransaction(async (client) => {
      const v = await queryOne(`SELECT user_id FROM verifications WHERE id = $1 FOR UPDATE`, [verificationId], client);
      if (!v) throw new Error("Verification not found");

      const row = await queryOne(
        `UPDATE verifications SET
          status = $2,
          decision = $3,
          decision_reason = $4,
          reviewed_by = $5,
          reviewed_at = NOW(),
          updated_at = NOW()
        WHERE id = $1
        RETURNING *`,
        [verificationId, data.status, data.decision, data.decisionReason || null, adminId],
        client
      );

      if (!row) throw new Error("Failed to update verification");

      await queryOne(
        `UPDATE profiles SET verification_status = $2, updated_at = NOW() WHERE id = $1`,
        [v.user_id, data.status],
        client
      );

      return this.mapVerification(row);
    }, { userId: adminId });
  }

  async listPendingVerifications(): Promise<Verification[]> {
    const rows = await queryAll(
      `SELECT * FROM verifications WHERE status = 'pending' ORDER BY created_at ASC`
    );
    return rows.map(r => this.mapVerification(r));
  }
  
  async getPendingVerification(userId: string): Promise<Verification | null> {
    const row = await queryOne(
      `SELECT * FROM verifications WHERE user_id = $1 AND status = 'pending'`,
      [userId]
    );
    return row ? this.mapVerification(row) : null;
  }

  async checkDuplicateNationalIdOrTin(nationalId: string | null, tinNumber: string | null): Promise<any[]> {
    const params = [];
    const conditions = [];
    if (nationalId) {
      params.push(nationalId);
      conditions.push(`national_id = $${params.length}`);
    }
    if (tinNumber) {
      params.push(tinNumber);
      conditions.push(`tin_number = $${params.length}`);
    }
    if (conditions.length === 0) return [];
    
    return await queryAll(
      `SELECT id, national_id, tin_number FROM profiles WHERE ${conditions.join(" OR ")}`,
      params
    );
  }

  private mapVerification(row: any): Verification {
    return {
      id: row.id,
      userId: row.user_id,
      documentType: row.document_type,
      documentNumber: row.document_number,
      status: row.status,
      decision: row.decision,
      decisionReason: row.decision_reason,
      reviewedBy: row.reviewed_by,
      reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : null,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString()
    };
  }
}
