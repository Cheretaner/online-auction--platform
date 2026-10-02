import { query, queryOne } from "../infrastructure/database/query.js";
import { twilioVoiceService } from "../infrastructure/voice/twilio.service.js";
import { AppError, HttpStatus } from "../shared/errors/index.js";
import { logger } from "../shared/utils/logger.js";

/**
 * Generate random 6-digit verification code
 */
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Request phone number verification
 */
export async function requestPhoneVerification(
  userId: string,
  phoneNumber: string,
): Promise<{ codeSent: boolean; expiresAt: Date }> {
  // Validate phone number format
  if (!twilioVoiceService.validatePhoneNumber(phoneNumber)) {
    throw new AppError(
      "Invalid phone number format. Please use E.164 format (e.g., +251911234567)",
      HttpStatus.BAD_REQUEST,
    );
  }

  // Check if Twilio is configured
  if (!twilioVoiceService.isEnabled()) {
    throw new AppError(
      "Voice/SMS service not configured. Please contact administrator.",
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  // Generate verification code
  const code = generateVerificationCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Store code in database
  await query(
    `UPDATE profiles
     SET phone_number = $2,
         phone_verified = false,
         phone_verification_code = $3,
         phone_verification_expires_at = $4
     WHERE id = $1`,
    [userId, phoneNumber, code, expiresAt],
  );

  // Send SMS with verification code
  const sent = await twilioVoiceService.sendVerificationSMS(phoneNumber, code);

  logger.info({
    event: "phone:verification_requested",
    userId,
    phoneNumber,
    codeSent: sent,
  });

  return {
    codeSent: sent,
    expiresAt,
  };
}

/**
 * Verify phone number with code
 */
export async function verifyPhoneNumber(
  userId: string,
  code: string,
): Promise<{ verified: boolean; phoneNumber: string }> {
  const row = await queryOne<{
    phone_number: string;
    phone_verification_code: string | null;
    phone_verification_expires_at: Date | null;
  }>(
    `SELECT phone_number, phone_verification_code, phone_verification_expires_at
     FROM profiles
     WHERE id = $1`,
    [userId],
  );

  if (!row || !row.phone_number) {
    throw new AppError("No phone verification in progress", HttpStatus.BAD_REQUEST);
  }

  if (!row.phone_verification_code || !row.phone_verification_expires_at) {
    throw new AppError("Verification code expired or not found", HttpStatus.BAD_REQUEST);
  }

  if (new Date() > row.phone_verification_expires_at) {
    throw new AppError("Verification code expired", HttpStatus.BAD_REQUEST);
  }

  if (row.phone_verification_code !== code) {
    throw new AppError("Invalid verification code", HttpStatus.BAD_REQUEST);
  }

  // Mark phone as verified and clear verification data
  await query(
    `UPDATE profiles
     SET phone_verified = true,
         phone_verification_code = NULL,
         phone_verification_expires_at = NULL
     WHERE id = $1`,
    [userId],
  );

  logger.info({
    event: "phone:verified",
    userId,
    phoneNumber: row.phone_number,
  });

  return {
    verified: true,
    phoneNumber: row.phone_number,
  };
}

/**
 * Get user's phone number and verification status
 */
export async function getPhoneStatus(userId: string): Promise<{
  phoneNumber: string | null;
  phoneVerified: boolean;
}> {
  const row = await queryOne<{
    phone_number: string | null;
    phone_verified: boolean;
  }>(
    `SELECT phone_number, phone_verified
     FROM profiles
     WHERE id = $1`,
    [userId],
  );

  return {
    phoneNumber: row?.phone_number ?? null,
    phoneVerified: row?.phone_verified ?? false,
  };
}

/**
 * Remove phone number from profile
 */
export async function removePhoneNumber(userId: string): Promise<void> {
  await query(
    `UPDATE profiles
     SET phone_number = NULL,
         phone_verified = false,
         phone_verification_code = NULL,
         phone_verification_expires_at = NULL
     WHERE id = $1`,
    [userId],
  );

  logger.info({
    event: "phone:removed",
    userId,
  });
}
