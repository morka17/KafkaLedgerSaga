import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KafkaModule, loadKafkaOptionsFromEnv } from '@saganova/kafka-client';
import { PostgresModule } from '@saganova/database';
import { PrometheusModule } from '@saganova/observability';

import { OrderEventStoreEntity } from './infrastructure/event-store/event-store.entity';
import { OrderProjectionEntity } from './infrastructure/postgres/order.entity';
import { OrderOutboxEntity } from './infrastructure/outbox/outbox.entity';

import { OrderEventStoreRepository } from './infrastructure/event-store/event-store.repository';
import { OrderProjectionRepository } from './infrastructure/postgres/order.repository';
import { OrderOutboxRepository } from './infrastructure/outbox/outbox.repository';
import { OrderOutboxRelayService } from './infrastructure/outbox/outbox-relay.service';
import { OrderKafkaConsumer } from './infrastructure/kafka/order-consumer.controller';
import { OrderKafkaProducer } from './infrastructure/kafka/order-producer.service';

import { CreateOrderHandler } from './application/commands/handlers/create-order.handler';
import { ConfirmOrderHandler } from './application/commands/handlers/confirm-order.handler';
import { CancelOrderHandler } from './application/commands/handlers/cancel-order.handler';
import { GetOrderByIdHandler } from './application/queries/get-order-by-id.handler';
import { OrderSaga } from './application/sagas/order.saga';

import { OrdersHttpController } from './interfaces/http/orders.controller';
import { HealthController } from './interfaces/http/health.controller';

const COMMAND_HANDLERS = [CreateOrderHandler, ConfirmOrderHandler, CancelOrderHandler];
const QUERY_HANDLERS = [GetOrderByIdHandler];

@Module({
  imports: [
    CqrsModule,
    PostgresModule.forService({
      schema: 'order_service',
      entities: [OrderEventStoreEntity, OrderProjectionEntity, OrderOutboxEntity],
    }),
    TypeOrmModule.forFeature([OrderEventStoreEntity, OrderProjectionEntity, OrderOutboxEntity]),
    KafkaModule.register(loadKafkaOptionsFromEnv('order-service')),
    PrometheusModule,
  ],
  controllers: [OrdersHttpController, HealthController],
  providers: [
    OrderEventStoreRepository,
    OrderProjectionRepository,
    OrderOutboxRepository,
    OrderOutboxRelayService,
    OrderKafkaConsumer,
    OrderKafkaProducer,
    OrderSaga,
    ...COMMAND_HANDLERS,
    ...QUERY_HANDLERS,
  ],
})
export class OrderModule {}
