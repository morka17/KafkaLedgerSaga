import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  EventStoreRow,
  IdempotencyService,
  OutboxRelayScheduler,
  PostgresModule,
  ProcessedMessageRow,
} from '@saganova/database';
import { CorrelationIdInterceptor, LoggingInterceptor } from '@saganova/common';
import { KafkaModule, loadKafkaOptionsFromEnv } from '@saganova/kafka-client';
import { OrderApplicationService } from './application/order-application.service';
import { OrderConsumerController } from './infrastructure/kafka/order-consumer.controller';
import { OrderEntity } from './infrastructure/postgres/order.entity';
import { OrderOutboxRow } from './infrastructure/outbox/order-outbox.entity';
import { OrdersController } from './interfaces/http/orders.controller';

@Module({
  imports: [
    KafkaModule.register(loadKafkaOptionsFromEnv('order-service')),
    PostgresModule.forService({
      schema: 'order_service',
      entities: [OrderEntity, OrderOutboxRow, EventStoreRow, ProcessedMessageRow],
      synchronize: process.env.DB_SYNC === 'true',
    }),
    TypeOrmModule.forFeature([OrderEntity, OrderOutboxRow, EventStoreRow, ProcessedMessageRow]),
  ],
  controllers: [OrderConsumerController, OrdersController],
  providers: [
    OrderApplicationService,
    IdempotencyService,
    OutboxRelayScheduler,
    { provide: APP_INTERCEPTOR, useClass: CorrelationIdInterceptor },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class OrderModule {}
