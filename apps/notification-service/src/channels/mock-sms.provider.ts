import { Injectable, Logger } from '@nestjs/common';
import { SmsMessage, SmsProvider } from './sms.provider';

/** Used when Twilio credentials are unset - logs instead of sending. */
@Injectable()
export class MockSmsProvider implements SmsProvider {
  private readonly logger = new Logger(MockSmsProvider.name);

  async send(message: SmsMessage): Promise<void> {
    this.logger.warn(`[MOCK SMS] to=${message.to}: ${message.body}`);
  }
}
