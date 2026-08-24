import { Injectable, Logger } from '@nestjs/common';
import sgMail from '@sendgrid/mail';

export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
}

export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}

/**
 * Real SendGrid integration. A failure here throws - the Kafka consumer
 * decides what to do with that (see notification-consumer.controller.ts's
 * doc comment on why it deliberately does NOT redeliver on send failure).
 */
@Injectable()
export class SendGridEmailProvider implements EmailProvider {
  private readonly logger = new Logger(SendGridEmailProvider.name);
  private readonly fromAddress: string;

  constructor() {
    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey) {
      throw new Error('SENDGRID_API_KEY must be set to use SendGridEmailProvider (use MockEmailProvider for local dev).');
    }
    sgMail.setApiKey(apiKey);
    this.fromAddress = process.env.NOTIFICATIONS_FROM_EMAIL ?? 'orders@saganova.example';
  }

  async send(message: EmailMessage): Promise<void> {
    await sgMail.send({
      to: message.to,
      from: this.fromAddress,
      subject: message.subject,
      text: message.body,
    });
    this.logger.log(`Email sent to ${message.to}: "${message.subject}"`);
  }
}
