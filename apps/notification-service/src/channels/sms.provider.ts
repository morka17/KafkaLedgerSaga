import { Injectable, Logger } from '@nestjs/common';
import Twilio from 'twilio';

export interface SmsMessage {
  to: string;
  body: string;
}

export const SMS_PROVIDER = Symbol('SMS_PROVIDER');

export interface SmsProvider {
  send(message: SmsMessage): Promise<void>;
}

@Injectable()
export class TwilioSmsProvider implements SmsProvider {
  private readonly logger = new Logger(TwilioSmsProvider.name);
  private readonly client: ReturnType<typeof Twilio>;
  private readonly fromNumber: string;

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;
    if (!accountSid || !authToken || !fromNumber) {
      throw new Error(
        'TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER must all be set to use TwilioSmsProvider (use MockSmsProvider for local dev).',
      );
    }
    this.client = Twilio(accountSid, authToken);
    this.fromNumber = fromNumber;
  }

  async send(message: SmsMessage): Promise<void> {
    await this.client.messages.create({ to: message.to, from: this.fromNumber, body: message.body });
    this.logger.log(`SMS sent to ${message.to}`);
  }
}
