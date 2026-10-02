import { closePool, getPool } from "../infrastructure/database/pool.js";
import { decryptSensitive, encryptSensitive, hashSensitive } from "../shared/security/sensitive-data.js";

interface LegacyProfile {
  id: string;
  national_id: string | null;
  tin_number: string | null;
}

interface LegacyVerification {
  id: string;
  document_number: string;
}

interface LegacyDeposit {
  id: string;
  reference_number: string;
}

async function main(): Promise<void> {
  const pool = getPool();
  let profileCount = 0;
  let verificationCount = 0;

  try {
    const profiles = await pool.query<LegacyProfile>(
      `SELECT id, national_id, tin_number FROM profiles
       WHERE (national_id IS NOT NULL AND national_id_hash IS NULL)
          OR (tin_number IS NOT NULL AND tin_number_hash IS NULL)`,
    );
    for (const row of profiles.rows) {
      const nationalId = decryptSensitive(row.national_id);
      const tinNumber = decryptSensitive(row.tin_number);
      await pool.query(
        `UPDATE profiles
         SET national_id = $2, tin_number = $3,
             national_id_hash = $4, tin_number_hash = $5, updated_at = NOW()
         WHERE id = $1`,
        [
          row.id,
          encryptSensitive(nationalId),
          encryptSensitive(tinNumber),
          hashSensitive(nationalId),
          hashSensitive(tinNumber),
        ],
      );
      profileCount += 1;
    }

    const verifications = await pool.query<LegacyVerification>(
      `SELECT id, document_number FROM verifications
       WHERE document_number NOT LIKE 'enc:v1:%'`,
    );
    for (const row of verifications.rows) {
      await pool.query(
        `UPDATE verifications SET document_number = $2, updated_at = NOW() WHERE id = $1`,
        [row.id, encryptSensitive(row.document_number)],
      );
      verificationCount += 1;
    }

    const deposits = await pool.query<LegacyDeposit>(
      `SELECT id, reference_number FROM deposits
       WHERE reference_number NOT LIKE 'enc:v1:%' OR reference_number_hash IS NULL`,
    );
    for (const row of deposits.rows) {
      const referenceNumber = decryptSensitive(row.reference_number);
      await pool.query(
        `UPDATE deposits SET reference_number = $2, reference_number_hash = $3, updated_at = NOW() WHERE id = $1`,
        [row.id, encryptSensitive(referenceNumber), hashSensitive(referenceNumber)],
      );
    }

    console.info(
      `Encrypted ${profileCount} profile record(s), ${verificationCount} verification record(s), and ${deposits.rowCount ?? 0} deposit reference(s).`,
    );
  } finally {
    await closePool();
  }
}

main().catch((error: unknown) => {
  console.error("PII migration failed", error);
  process.exitCode = 1;
});