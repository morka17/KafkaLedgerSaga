import 'reflect-metadata';
import { bootstrapTracing } from '@saganova/observability';
bootstrapTracing('payment-service');

import { NestFactory } from '@nestjs/core';
import { PaymentModule } from './payment.module';
import { AllExceptionsFilter, CorrelationIdInterceptor, LoggingInterceptor, ValidationPipe } from '@saganova/common';

async function bootstrap() {
  const required = ['DB_HOST', 'KAFKA_BROKERS'];
  const missing = required.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    // eslint-disable-next-line no-console
    console.error(`Refusing to start: missing required env var(s): ${missing.join(', ')}`);
    process.exit(1);
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    // eslint-disable-next-line no-console
    console.warn('STRIPE_SECRET_KEY not set - payment-service will use MockStripeAdapter. Do not run this in production without it.');
  }

  const app = await NestFactory.create(PaymentModule);
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new CorrelationIdInterceptor(), new LoggingInterceptor());
  app.useGlobalPipes(new ValidationPipe());
  app.enableShutdownHooks();

  const port = process.env.PAYMENT_SERVICE_PORT ?? 3002;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`payment-service listening on :${port}`);
}

bootstrap();
