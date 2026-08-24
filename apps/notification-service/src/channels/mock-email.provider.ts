import { Injectable, Logger } from '@nestjs/common';
import { EmailMessage, EmailProvider } from './email.provider';

/** Used when SENDGRID_API_KEY is unset - logs instead of sending, so local dev/CI never needs real credentials. */
@Injectable()
export class MockEmailProvider implements EmailProvider {
  private readonly logger = new Logger(MockEmailProvider.name);

  async send(message: EmailMessage): Promise<void> {
    this.logger.warn(`[MOCK EMAIL] to=${message.to} subject="${message.subject}"\n${message.body}`);
  }
}
