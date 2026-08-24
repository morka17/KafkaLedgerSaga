import { Module } from '@nestjs/common';
import { EMAIL_PROVIDER, SendGridEmailProvider } from './channels/email.provider';
import { MockEmailProvider } from './channels/mock-email.provider';
import { SMS_PROVIDER, TwilioSmsProvider } from './channels/sms.provider';
import { MockSmsProvider } from './channels/mock-sms.provider';
import { CustomerContactResolver } from './channels/customer-contact.resolver';
import { NotificationKafkaConsumer } from './kafka/notification-consumer.controller';
import { HealthController } from './interfaces/http/health.controller';

const hasSendGrid = !!process.env.SENDGRID_API_KEY;
const hasTwilio = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER);

@Module({
  controllers: [HealthController],
  providers: [
    {
      provide: EMAIL_PROVIDER,
      useClass: hasSendGrid ? SendGridEmailProvider : MockEmailProvider,
    },
    {
      provide: SMS_PROVIDER,
      useClass: hasTwilio ? TwilioSmsProvider : MockSmsProvider,
    },
    CustomerContactResolver,
    NotificationKafkaConsumer,
  ],
})
export class NotificationModule {}
