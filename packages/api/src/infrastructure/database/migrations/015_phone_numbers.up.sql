-- 015_phone_numbers.up.sql
--
-- Add phone number support for voice call alerts

-- Add phone number and verification status to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_verification_code VARCHAR(10);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_verification_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone_number) WHERE phone_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_phone_verified ON profiles(phone_verified) WHERE phone_verified = true;

COMMENT ON COLUMN profiles.phone_number IS 'User phone number for voice/SMS notifications (E.164 format recommended)';
COMMENT ON COLUMN profiles.phone_verified IS 'Whether phone number has been verified';
