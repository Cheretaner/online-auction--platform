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
    logger.info({ mail: message }, "Mail sent (console adapter)");
  }
}

export const mailAdapter: MailAdapter = new ConsoleMailAdapter();
