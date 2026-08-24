import 'reflect-metadata';
import { bootstrapTracing } from '@saganova/observability';
bootstrapTracing('audit-ledger-service');

import { NestFactory } from '@nestjs/core';
import { AuditModule } from './audit.module';
import { AllExceptionsFilter, CorrelationIdInterceptor, LoggingInterceptor } from '@saganova/common';

async function bootstrap() {
  const required = ['DB_HOST', 'KAFKA_BROKERS'];
  const missing = required.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    // eslint-disable-next-line no-console
    console.error(`Refusing to start: missing required env var(s): ${missing.join(', ')}`);
    process.exit(1);
  }

  const app = await NestFactory.create(AuditModule);
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new CorrelationIdInterceptor(), new LoggingInterceptor());
  app.enableShutdownHooks();

  const port = process.env.AUDIT_LEDGER_SERVICE_PORT ?? 3005;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`audit-ledger-service listening on :${port}`);
}

bootstrap();
