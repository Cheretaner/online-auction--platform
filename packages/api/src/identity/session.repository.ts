import { query, queryOne } from "../infrastructure/database/query.js";

/** Grace window for a refresh token that was just rotated. Two browser tabs
 * sharing one stored token can both try to refresh at the same moment; the
 * loser should simply fail, not trigger theft handling for the whole family. */
const ROTATION_GRACE_SECONDS = 30;

export async function recordRefreshToken(input: {
  jti: string;
  userId: string;
  familyId: string;
  expiresAt: Date;
}): Promise<void> {
  await query(
    `INSERT INTO refresh_tokens (jti, user_id, family_id, expires_at) VALUES ($1, $2, $3, $4)`,
    [input.jti, input.userId, input.familyId, input.expiresAt],
  );
}

export type ConsumeResult =
  | { status: "ok"; familyId: string }
  | { status: "unknown" }
  | { status: "recently_rotated" }
  | { status: "reused"; familyId: string };

/** Atomically marks a refresh token as used. Exactly one caller can consume a
 * given token; anyone presenting it afterwards gets `recently_rotated` (within
 * the grace window) or `reused`. */
export async function consumeRefreshToken(jti: string, userId: string): Promise<ConsumeResult> {
  const consumed = await queryOne<{ family_id: string }>(
    `UPDATE refresh_tokens
        SET revoked_at = now()
      WHERE jti = $1 AND user_id = $2 AND revoked_at IS NULL AND expires_at > now()
      RETURNING family_id`,
    [jti, userId],
  );
  if (consumed) return { status: "ok", familyId: consumed.family_id };

  const existing = await queryOne<{ family_id: string; recent: boolean; rotated: boolean }>(
    `SELECT family_id,
            revoked_at > now() - make_interval(secs => $3) AS recent,
            replaced_by IS NOT NULL AS rotated
       FROM refresh_tokens
      WHERE jti = $1 AND user_id = $2`,
    [jti, userId, ROTATION_GRACE_SECONDS],
  );
  if (!existing) return { status: "unknown" };
  if (existing.rotated && existing.recent) return { status: "recently_rotated" };
  return { status: "reused", familyId: existing.family_id };
}

export async function markReplaced(jti: string, replacedBy: string): Promise<void> {
  await query(`UPDATE refresh_tokens SET replaced_by = $2 WHERE jti = $1`, [jti, replacedBy]);
}

export async function revokeFamily(familyId: string): Promise<void> {
  await query(
    `UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, now()) WHERE family_id = $1`,
    [familyId],
  );
}

export async function revokeFamilyOf(jti: string, userId: string): Promise<void> {
  await query(
    `UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, now())
      WHERE family_id = (SELECT family_id FROM refresh_tokens WHERE jti = $1 AND user_id = $2)`,
    [jti, userId],
  );
}

export async function revokeAllForUser(userId: string): Promise<void> {
  await query(
    `UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, now()) WHERE user_id = $1`,
    [userId],
  );
}

export async function pruneExpiredRefreshTokens(): Promise<void> {
  await query(`DELETE FROM refresh_tokens WHERE expires_at < now() - interval '1 day'`);
  await query(`DELETE FROM password_resets WHERE expires_at < now() - interval '1 day'`);
}

export async function createPasswordReset(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
  // A new request supersedes any earlier unused link for the same account.
  await query(`UPDATE password_resets SET used_at = now() WHERE user_id = $1 AND used_at IS NULL`, [userId]);
  await query(
    `INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt],
  );
}

/** Marks a reset token used and returns its user, or null when the token is
 * unknown, expired or already used. Atomic, so a link works exactly once. */
export async function consumePasswordReset(tokenHash: string): Promise<string | null> {
  const row = await queryOne<{ user_id: string }>(
    `UPDATE password_resets SET used_at = now()
      WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
      RETURNING user_id`,
    [tokenHash],
  );
  return row?.user_id ?? null;
}
