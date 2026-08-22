import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KafkaModule, loadKafkaOptionsFromEnv } from '@saganova/kafka-client';
import { PostgresModule } from '@saganova/database';
import { PrometheusModule } from '@saganova/observability';

import { PaymentEventStoreEntity } from './infrastructure/event-store/event-store.entity';
import { PaymentProjectionEntity } from './infrastructure/postgres/payment.entity';
import { PaymentOutboxEntity } from './infrastructure/outbox/outbox.entity';

import { PaymentEventStoreRepository } from './infrastructure/event-store/event-store.repository';
import { PaymentProjectionRepository } from './infrastructure/postgres/payment.repository';
import { PaymentOutboxRepository } from './infrastructure/outbox/outbox.repository';
import { PaymentOutboxRelayService } from './infrastructure/outbox/outbox-relay.service';
import { PaymentKafkaConsumer } from './infrastructure/kafka/payment-consumer.controller';
import { PaymentKafkaProducer } from './infrastructure/kafka/payment-producer.service';
import { PAYMENT_GATEWAY } from './infrastructure/gateways/payment-gateway.interface';
import { StripeAdapter } from './infrastructure/gateways/stripe.adapter';
import { MockStripeAdapter } from './infrastructure/gateways/mock-stripe.adapter';

import { AuthorizePaymentHandler } from './application/commands/handlers/authorize-payment.handler';
import { RefundPaymentHandler } from './application/commands/handlers/refund-payment.handler';
import { PaymentSaga } from './application/sagas/payment.saga';

import { HealthController } from './interfaces/http/health.controller';

const COMMAND_HANDLERS = [AuthorizePaymentHandler, RefundPaymentHandler];

@Module({
  imports: [
    CqrsModule,
    PostgresModule.forService({
      schema: 'payment_service',
      entities: [PaymentEventStoreEntity, PaymentProjectionEntity, PaymentOutboxEntity],
    }),
    TypeOrmModule.forFeature([PaymentEventStoreEntity, PaymentProjectionEntity, PaymentOutboxEntity]),
    KafkaModule.register(loadKafkaOptionsFromEnv('payment-service')),
    PrometheusModule,
  ],
  controllers: [HealthController],
  providers: [
    PaymentEventStoreRepository,
    PaymentProjectionRepository,
    PaymentOutboxRepository,
    PaymentOutboxRelayService,
    PaymentKafkaConsumer,
    PaymentKafkaProducer,
    PaymentSaga,
    {
      // STRIPE_SECRET_KEY absent -> mock adapter, so local dev and CI
      // never need real Stripe credentials to exercise the full saga,
      // including the decline/compensation path (see MockStripeAdapter).
      provide: PAYMENT_GATEWAY,
      useClass: process.env.STRIPE_SECRET_KEY ? StripeAdapter : MockStripeAdapter,
    },
    ...COMMAND_HANDLERS,
  ],
})
export class PaymentModule {}
