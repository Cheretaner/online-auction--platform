-- 015_phone_numbers.down.sql

DROP INDEX IF EXISTS idx_profiles_phone_verified;
DROP INDEX IF EXISTS idx_profiles_phone;

ALTER TABLE profiles DROP COLUMN IF EXISTS phone_verification_expires_at;
ALTER TABLE profiles DROP COLUMN IF EXISTS phone_verification_code;
ALTER TABLE profiles DROP COLUMN IF EXISTS phone_verified;
ALTER TABLE profiles DROP COLUMN IF EXISTS phone_number;
