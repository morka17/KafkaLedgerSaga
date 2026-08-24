import 'reflect-metadata';
import { bootstrapTracing } from '@saganova/observability';
bootstrapTracing('notification-service');

import { NestFactory } from '@nestjs/core';
import { NotificationModule } from './notification.module';
import { AllExceptionsFilter, CorrelationIdInterceptor, LoggingInterceptor } from '@saganova/common';

async function bootstrap() {
  const required = ['KAFKA_BROKERS'];
  const missing = required.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    // eslint-disable-next-line no-console
    console.error(`Refusing to start: missing required env var(s): ${missing.join(', ')}`);
    process.exit(1);
  }

  if (!process.env.SENDGRID_API_KEY) {
    // eslint-disable-next-line no-console
    console.warn('SENDGRID_API_KEY not set - using MockEmailProvider. Do not run this in production without it.');
  }
  if (!process.env.TWILIO_ACCOUNT_SID) {
    // eslint-disable-next-line no-console
    console.warn('Twilio credentials not set - using MockSmsProvider. Do not run this in production without them.');
  }

  const app = await NestFactory.create(NotificationModule);
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new CorrelationIdInterceptor(), new LoggingInterceptor());
  app.enableShutdownHooks();

  const port = process.env.NOTIFICATION_SERVICE_PORT ?? 3006;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`notification-service listening on :${port}`);
}

bootstrap();
