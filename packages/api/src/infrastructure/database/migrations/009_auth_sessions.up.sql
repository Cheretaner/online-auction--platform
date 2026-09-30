-- 009_auth_sessions
-- Server-side state for refresh tokens and password resets.
--
-- refresh_tokens: every issued refresh token is recorded by its jti. A token
-- is single-use: refreshing marks it revoked and issues a successor in the
-- same family. Presenting an already-revoked token means it was stolen or
-- replayed, so the whole family (every device session descended from that
-- login) is revoked.
CREATE TABLE IF NOT EXISTS refresh_tokens (
  jti          uuid PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  family_id    uuid NOT NULL,
  expires_at   timestamptz NOT NULL,
  revoked_at   timestamptz,
  replaced_by  uuid,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family ON refresh_tokens (family_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens (expires_at);

-- password_resets: only a SHA-256 of the emailed token is stored, so a
-- database read does not yield usable reset links.
CREATE TABLE IF NOT EXISTS password_resets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token_hash  text NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets (user_id);
