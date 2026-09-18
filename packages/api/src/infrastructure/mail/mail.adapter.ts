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
}

export class ConsoleMailAdapter implements MailAdapter {
  async send(message: MailMessage): Promise<void> {
    logger.info({ mail: { to: message.to, subject: message.subject } }, "Mail sent (console adapter)");
  }
}

export class SmtpMailAdapter implements MailAdapter {
  constructor(
    private readonly transporter: Transporter,
    private readonly from: string,
  ) {}

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
    return new ConsoleMailAdapter();
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });

  return new SmtpMailAdapter(transporter, env.MAIL_FROM);
}

export const mailAdapter: MailAdapter = createMailAdapter();
