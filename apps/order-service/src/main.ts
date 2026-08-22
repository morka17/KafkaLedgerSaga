import 'reflect-metadata';
import { bootstrapTracing } from '@saganova/observability';
bootstrapTracing('order-service');

import { NestFactory } from '@nestjs/core';
import { AllExceptionsFilter, ValidationPipe } from '@saganova/common';
import { kafkaMicroserviceOptions, loadKafkaOptionsFromEnv } from '@saganova/kafka-client';
import { SAGA_COMMANDS_TOPIC } from '@saganova/event-contracts';
import { OrderModule } from './order.module';

async function bootstrap() {
  const app = await NestFactory.create(OrderModule);
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(new ValidationPipe());
  app.enableShutdownHooks();

  app.connectMicroservice(
    kafkaMicroserviceOptions(loadKafkaOptionsFromEnv('order-service'), 'commands', [SAGA_COMMANDS_TOPIC]),
  );

  await app.startAllMicroservices();
  await app.listen(process.env.ORDER_SERVICE_PORT ?? 3001);
}

bootstrap();
