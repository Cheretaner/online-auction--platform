-- Rollback 009_auth_sessions
DROP TABLE IF EXISTS password_resets;
DROP TABLE IF EXISTS refresh_tokens;
