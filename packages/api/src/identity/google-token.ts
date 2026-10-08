import { OAuth2Client } from "google-auth-library";
import { env } from "../config/env.js";
import { AppError, HttpStatus } from "../shared/errors/index.js";

const client = new OAuth2Client();

export interface GoogleIdentity {
  subject: string;
  email: string;
  name?: string;
}

function isVerificationServiceUnavailable(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  if (error.message.toLowerCase().includes("verification certificates")) return true;

  if (typeof error !== "object" || error === null) return false;
  const details = error as { code?: unknown; response?: { status?: unknown } };
  const status = details.response?.status;
  if (typeof status === "number" && (status === 429 || status >= 500)) return true;

  return (
    typeof details.code === "string" &&
    ["ECONNRESET", "ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "ETIMEDOUT", "ENETUNREACH"].includes(
      details.code,
    )
  );
}

export async function verifyGoogleCredential(credential: string): Promise<GoogleIdentity> {
  if (!env.GOOGLE_CLIENT_ID) {
    throw new AppError("Google sign-in is not configured", HttpStatus.SERVICE_UNAVAILABLE);
  }

  let payload;
  try {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch (error) {
    if (isVerificationServiceUnavailable(error)) {
      throw new AppError("Google sign-in is temporarily unavailable", HttpStatus.SERVICE_UNAVAILABLE);
    }
    throw AppError.unauthorized("Invalid Google credential");
  }

  if (!payload?.sub || !payload.email || payload.email_verified !== true) {
    throw AppError.unauthorized("Google must provide a verified email address");
  }

  return {
    subject: payload.sub,
    email: payload.email,
    name: payload.name,
  };
}
