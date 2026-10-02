import twilio from "twilio";
import { env } from "../../config/env.js";
import { logger } from "../../shared/utils/logger.js";

export interface VoiceCallOptions {
  to: string; // Phone number in E.164 format
  message: string;
  priority?: 'normal' | 'high';
}

export interface VoiceCallResult {
  success: boolean;
  callSid?: string;
  error?: string;
}

class TwilioVoiceService {
  private client: ReturnType<typeof twilio> | null = null;
  private fromNumber: string | null = null;
  private enabled: boolean = false;

  constructor() {
    if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_PHONE_NUMBER) {
      try {
        this.client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
        this.fromNumber = env.TWILIO_PHONE_NUMBER;
        this.enabled = true;
        logger.info("Twilio voice service initialized");
      } catch (error) {
        logger.error({ err: error }, "Failed to initialize Twilio client");
        this.enabled = false;
      }
    } else {
      logger.info("Twilio credentials not configured - voice calls disabled");
      this.enabled = false;
    }
  }

  /**
   * Make an outbound voice call with text-to-speech message
   */
  async makeCall(options: VoiceCallOptions): Promise<VoiceCallResult> {
    if (!this.enabled || !this.client || !this.fromNumber) {
      logger.warn({ to: options.to }, "Twilio not configured, voice call skipped");
      return {
        success: false,
        error: "Voice calls not configured",
      };
    }

    try {
      // Generate TwiML for text-to-speech
      const twiml = this.generateTwiML(options.message);

      logger.info({
        event: "voice:call_initiated",
        to: options.to,
        priority: options.priority,
      });

      const call = await this.client.calls.create({
        to: options.to,
        from: this.fromNumber,
        twiml,
        // Optional: Set status callback to track call completion
        // statusCallback: `${env.API_BASE_URL}/api/v1/voice/status`,
        // statusCallbackMethod: 'POST',
      });

      logger.info({
        event: "voice:call_created",
        to: options.to,
        callSid: call.sid,
        status: call.status,
      });

      return {
        success: true,
        callSid: call.sid,
      };
    } catch (error) {
      logger.error({
        event: "voice:call_failed",
        to: options.to,
        error,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Generate TwiML (Twilio Markup Language) for text-to-speech
   */
  private generateTwiML(message: string): string {
    // Sanitize message to prevent TwiML injection
    const sanitized = message
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

    // Ethiopian Auction Platform voice greeting
    const greeting = "This is a notification from the Ethiopian Transparent Auction System.";
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna" language="en-US">${greeting}</Say>
  <Pause length="1"/>
  <Say voice="Polly.Joanna" language="en-US">${sanitized}</Say>
  <Pause length="1"/>
  <Say voice="Polly.Joanna" language="en-US">Thank you for using our service.</Say>
</Response>`;
  }

  /**
   * Send verification code via SMS (for phone number verification)
   */
  async sendVerificationSMS(to: string, code: string): Promise<boolean> {
    if (!this.enabled || !this.client || !this.fromNumber) {
      logger.warn({ to }, "Twilio not configured, SMS skipped");
      return false;
    }

    try {
      const message = `Your verification code for Ethiopian Auction Platform is: ${code}. This code expires in 10 minutes.`;

      await this.client.messages.create({
        to,
        from: this.fromNumber,
        body: message,
      });

      logger.info({
        event: "voice:sms_sent",
        to,
      });

      return true;
    } catch (error) {
      logger.error({
        event: "voice:sms_failed",
        to,
        error,
      });
      return false;
    }
  }

  /**
   * Check if Twilio is configured and enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Validate phone number format (basic E.164 check)
   */
  validatePhoneNumber(phoneNumber: string): boolean {
    // E.164 format: +[country code][number]
    // Example: +251911234567 (Ethiopia)
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    return e164Regex.test(phoneNumber);
  }
}

// Singleton instance
export const twilioVoiceService = new TwilioVoiceService();
