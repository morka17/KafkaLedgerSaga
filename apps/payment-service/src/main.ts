import 'reflect-metadata';
import { bootstrapTracing } from '@saganova/observability';
bootstrapTracing('payment-service');

import { NestFactory } from '@nestjs/core';
import { AllExceptionsFilter, ValidationPipe } from '@saganova/common';
import { kafkaMicroserviceOptions, loadKafkaOptionsFromEnv } from '@saganova/kafka-client';
import { SAGA_COMMANDS_TOPIC } from '@saganova/event-contracts';
import { PaymentModule } from './payment.module';

async function bootstrap() {
  const app = await NestFactory.create(PaymentModule);
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(new ValidationPipe());
  app.enableShutdownHooks();

  app.connectMicroservice(
    kafkaMicroserviceOptions(loadKafkaOptionsFromEnv('payment-service'), 'commands', [SAGA_COMMANDS_TOPIC]),
  );

  await app.startAllMicroservices();
  await app.listen(process.env.PAYMENT_SERVICE_PORT ?? 3002);
}

bootstrap();
