import { queryOne, queryAll } from "../infrastructure/database/query.js";
import { withTransaction } from "../infrastructure/database/tx.js";
import type { Verification } from "./verification.types.js";

interface DbVerification {
  id: string;
  user_id: string;
  document_type: string;
  document_number: string;
  status: Verification["status"];
  decision: string | null;
  decision_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

function mapVerification(row: DbVerification): Verification {
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
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export class VerificationRepository {
  async createVerification(
    userId: string,
    data: { documentType: string; documentNumber: string },
  ): Promise<Verification> {
    return withTransaction(async (client) => {
      await queryOne(
        `UPDATE profiles SET verification_status = 'pending', updated_at = NOW() WHERE id = $1`,
        [userId],
        client,
      );

      const row = await queryOne<DbVerification>(
        `INSERT INTO verifications (user_id, document_type, document_number, status)
         VALUES ($1, $2, $3, 'pending')
         RETURNING *`,
        [userId, data.documentType, data.documentNumber],
        client,
      );

      if (!row) throw new Error("Failed to create verification");
      return mapVerification(row);
    }, { userId });
  }

  async reviewVerification(
    reviewerId: string,
    verificationId: string,
    data: {
      status: "verified" | "rejected";
      decision: "approved" | "rejected" | "resubmission_required";
      decisionReason?: string;
    },
  ): Promise<Verification> {
    return withTransaction(async (client) => {
      // Lock the row so two reviewers cannot both act on the same pending
      // submission, and re-check the status inside the lock.
      const current = await queryOne<{ user_id: string; status: string }>(
        `SELECT user_id, status FROM verifications WHERE id = $1 FOR UPDATE`,
        [verificationId],
        client,
      );
      if (!current) throw new Error("Verification not found");

      const row = await queryOne<DbVerification>(
        `UPDATE verifications SET
           status = $2,
           decision = $3,
           decision_reason = $4,
           reviewed_by = $5,
           reviewed_at = NOW(),
           updated_at = NOW()
         WHERE id = $1 AND status = 'pending'
         RETURNING *`,
        [verificationId, data.status, data.decision, data.decisionReason ?? null, reviewerId],
        client,
      );

      if (!row) throw new Error("Verification is no longer pending");

      await queryOne(
        `UPDATE profiles SET verification_status = $2, updated_at = NOW() WHERE id = $1`,
        [current.user_id, data.status],
        client,
      );

      return mapVerification(row);
    }, { userId: reviewerId });
  }

  async findById(id: string): Promise<Verification | null> {
    const row = await queryOne<DbVerification>(`SELECT * FROM verifications WHERE id = $1`, [id]);
    return row ? mapVerification(row) : null;
  }

  async listPendingVerifications(): Promise<Verification[]> {
    const rows = await queryAll<DbVerification>(
      `SELECT * FROM verifications WHERE status = 'pending' ORDER BY created_at ASC`,
    );
    return rows.map(mapVerification);
  }

  async getPendingVerification(userId: string): Promise<Verification | null> {
    const row = await queryOne<DbVerification>(
      `SELECT * FROM verifications WHERE user_id = $1 AND status = 'pending'`,
      [userId],
    );
    return row ? mapVerification(row) : null;
  }

  async findLatestForUser(userId: string): Promise<Verification | null> {
    const row = await queryOne<DbVerification>(
      `SELECT * FROM verifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [userId],
    );
    return row ? mapVerification(row) : null;
  }

  async checkDuplicateNationalIdOrTin(
    nationalId: string | null,
    tinNumber: string | null,
  ): Promise<Array<{ id: string; national_id: string | null; tin_number: string | null }>> {
    const params: string[] = [];
    const conditions: string[] = [];

    if (nationalId) {
      params.push(nationalId);
      conditions.push(`national_id = $${params.length}`);
    }
    if (tinNumber) {
      params.push(tinNumber);
      conditions.push(`tin_number = $${params.length}`);
    }
    if (conditions.length === 0) return [];

    return queryAll<{ id: string; national_id: string | null; tin_number: string | null }>(
      `SELECT id, national_id, tin_number FROM profiles WHERE ${conditions.join(" OR ")}`,
      params,
    );
  }
}
