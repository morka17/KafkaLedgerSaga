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
import { PaymentApplicationService } from './application/payment-application.service';
import { StripeAdapter } from './infrastructure/gateways/stripe.adapter';
import { PaymentConsumerController } from './infrastructure/kafka/payment-consumer.controller';
import { PaymentEntity } from './infrastructure/postgres/payment.entity';
import { PaymentOutboxRow } from './infrastructure/outbox/payment-outbox.entity';

@Module({
  imports: [
    KafkaModule.register(loadKafkaOptionsFromEnv('payment-service')),
    PostgresModule.forService({
      schema: 'payment_service',
      entities: [PaymentEntity, PaymentOutboxRow, EventStoreRow, ProcessedMessageRow],
      synchronize: process.env.DB_SYNC === 'true',
    }),
    TypeOrmModule.forFeature([PaymentEntity, PaymentOutboxRow, EventStoreRow, ProcessedMessageRow]),
  ],
  controllers: [PaymentConsumerController],
  providers: [
    PaymentApplicationService,
    StripeAdapter,
    IdempotencyService,
    OutboxRelayScheduler,
    { provide: APP_INTERCEPTOR, useClass: CorrelationIdInterceptor },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class PaymentModule {}
