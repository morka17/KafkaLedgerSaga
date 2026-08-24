import 'reflect-metadata';
import { bootstrapTracing } from '@saganova/observability';
bootstrapTracing('saga-orchestrator');

import { NestFactory } from '@nestjs/core';
import { SagaModule } from './saga.module';
import { AllExceptionsFilter, CorrelationIdInterceptor, LoggingInterceptor, ValidationPipe } from '@saganova/common';

async function bootstrap() {
  const required = ['DB_HOST', 'KAFKA_BROKERS'];
  const missing = required.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    // eslint-disable-next-line no-console
    console.error(`Refusing to start: missing required env var(s): ${missing.join(', ')}`);
    process.exit(1);
  }

  const app = await NestFactory.create(SagaModule);
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new CorrelationIdInterceptor(), new LoggingInterceptor());
  app.useGlobalPipes(new ValidationPipe());
  app.enableShutdownHooks();

  const port = process.env.SAGA_ORCHESTRATOR_PORT ?? 3004;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`saga-orchestrator listening on :${port}`);
}

bootstrap();
