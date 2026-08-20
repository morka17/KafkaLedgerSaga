import 'reflect-metadata';
import { bootstrapTracing } from '@saganova/observability';
bootstrapTracing('api-gateway'); // must run before Nest boots, so auto-instrumentation attaches in time

import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter, ValidationPipe } from '@saganova/common';
import { HealthController } from './health/health.controller';
import { KafkaProducerService } from '@saganova/kafka-client';

async function bootstrap() {
  const requiredEnvVars = ['JWT_SECRET', 'KAFKA_BROKERS'];
  const missing = requiredEnvVars.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    // eslint-disable-next-line no-console
    console.error(`Refusing to start: missing required env var(s): ${missing.join(', ')}`);
    process.exit(1);
  }

  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? '*',
    credentials: true,
  });

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(new ValidationPipe());
  app.setGlobalPrefix('api/v1', { exclude: ['health/live', 'health/ready'] });

  app.enableShutdownHooks();

  // Nest already ran the Kafka producer's onModuleInit() (i.e. connected
  // it) as part of NestFactory.create()'s lifecycle - we just need to
  // confirm the provider exists and flip readiness, not connect it again.
  app.get(KafkaProducerService);
  HealthController.markKafkaReady(true);

  const port = process.env.API_GATEWAY_PORT ?? 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`api-gateway listening on :${port}`);
}

bootstrap();
