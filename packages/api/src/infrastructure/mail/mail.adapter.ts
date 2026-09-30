import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { env } from "../../config/env.js";
import { logger } from "../../shared/utils/logger.js";

export interface MailMessage {
  to: string;
  subject: string;
  body: string;
}

export interface MailAdapter {
  send(message: MailMessage): Promise<void>;
  verify(): Promise<void>;
}

export class ConsoleMailAdapter implements MailAdapter {
  async verify(): Promise<void> {}

  async send(message: MailMessage): Promise<void> {
    // Only local development prints the body (it can hold a password-reset
    // link). Everywhere else the console adapter records that mail was due.
    const body = env.NODE_ENV === "development" ? message.body : undefined;
    logger.info({ mail: { to: message.to, subject: message.subject, body } }, "Mail sent (console adapter)");
  }
}

export class SmtpMailAdapter implements MailAdapter {
  constructor(
    private readonly transporter: Transporter,
    private readonly from: string,
  ) {}

  async verify(): Promise<void> {
    await this.transporter.verify();
  }

  async send(message: MailMessage): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.body,
    });
  }
}

export function createMailAdapter(): MailAdapter {
  if (!env.SMTP_HOST) {
    if (env.NODE_ENV === "production") {
      logger.warn("SMTP_HOST is not set: email notifications and password-reset links will not be delivered");
    }
    return new ConsoleMailAdapter();
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });

  return new SmtpMailAdapter(transporter, env.MAIL_FROM);
}

export const mailAdapter: MailAdapter = createMailAdapter();
