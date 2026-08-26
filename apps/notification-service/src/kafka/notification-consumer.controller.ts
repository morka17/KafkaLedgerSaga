import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Consumer, Kafka } from 'kafkajs';
import {
  ORDER_TOPIC,
  PAYMENT_TOPIC,
  OrderEventType,
  OrderConfirmedPayload,
  OrderCancelledPayload,
  PaymentEventType,
  PaymentDeclinedPayload,
  EventEnvelope,
} from '@saganova/event-contracts';
import { loadKafkaOptionsFromEnv, consumerGroupId } from '@saganova/kafka-client';
import { EMAIL_PROVIDER, EmailProvider } from '../channels/email.provider';
import { SMS_PROVIDER, SmsProvider } from '../channels/sms.provider';
import { CustomerContactResolver } from '../channels/customer-contact.resolver';
import { orderConfirmedEmail, orderCancelledEmail, paymentDeclinedSms } from '../channels/templates';

/**
 * Deliberately NOT on the saga's critical path. If sending an email or
 * SMS fails, that failure must never cause a checkout to be retried,
 * rolled back, or blocked - the money and inventory decisions are
 * already final by the time these events fire. So unlike every other
 * consumer in this system, a send failure here is caught, logged, and
 * the offset is committed anyway: an undelivered notification is an
 * acceptable, recoverable loss; redelivering it forever is not
 * (Kafka would redeliver the SAME failing message indefinitely if we
 * threw and left the offset uncommitted).
 *
 * This service also has no database - no outbox, no idempotency store -
 * by design (see package.json: no @saganova/database dependency). The
 * acceptable consequence is that a redelivered event can occasionally
 * send a duplicate notification. That trade-off is fine for "you got a
 * confirmation email twice"; it would NOT be fine for a payment charge,
 * which is exactly why order-service/payment-service do carry that
 * infrastructure and this one doesn't.
 */
@Injectable()
export class NotificationKafkaConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationKafkaConsumer.name);
  private readonly kafka: Kafka;
  private consumer!: Consumer;

  constructor(
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
    @Inject(SMS_PROVIDER) private readonly smsProvider: SmsProvider,
    private readonly contactResolver: CustomerContactResolver,
  ) {
    const opts = loadKafkaOptionsFromEnv('notification-service');
    this.kafka = new Kafka({
      clientId: opts.serviceName,
      brokers: opts.brokers,
      ssl: opts.ssl,
      sasl: opts.sasl,
    });
  }

  async onModuleInit() {
    this.consumer = this.kafka.consumer({
      groupId: consumerGroupId('notification-service', 'customer-notifications'),
    });

    await this.consumer.connect();
    await this.consumer.subscribe({ topics: [ORDER_TOPIC, PAYMENT_TOPIC], fromBeginning: false });

    await this.consumer.run({
      autoCommit: false,
      eachMessage: async ({ topic, partition, message }) => {
        if (!message.value) return;
        const envelope = JSON.parse(message.value.toString('utf-8')) as EventEnvelope<Record<string, unknown>>;

        try {
          await this.dispatch(envelope);
        } catch (err) {
          // Logged, NOT rethrown - see class doc comment on why this
          // consumer commits past failures instead of blocking on them.
          this.logger.error(`Failed to send notification for ${envelope.type} (id=${envelope.id}): ${(err as Error).message}`);
        }

        await this.consumer.commitOffsets([
          { topic, partition, offset: (BigInt(message.offset) + BigInt(1)).toString() },
        ]);
      },
    });

    this.logger.log(`Subscribed to [${ORDER_TOPIC}, ${PAYMENT_TOPIC}] as group ${consumerGroupId('notification-service', 'customer-notifications')}`);
  }

  private async dispatch(envelope: EventEnvelope<Record<string, unknown>>): Promise<void> {
    switch (envelope.type) {
      case OrderEventType.ORDER_CONFIRMED: {
        const payload = envelope.payload as unknown as OrderConfirmedPayload;
        const contact = await this.contactResolver.resolve(payload.customerId!);
        await this.emailProvider.send({ to: contact.email, ...orderConfirmedEmail(payload) });
        return;
      }
      case OrderEventType.ORDER_CANCELLED: {
        const payload = envelope.payload as unknown as OrderCancelledPayload;
        const contact = await this.contactResolver.resolve(payload.customerId!);
        await this.emailProvider.send({ to: contact.email, ...orderCancelledEmail(payload) });
        return;
      }
      case PaymentEventType.PAYMENT_DECLINED: {
        const payload = envelope.payload as unknown as PaymentDeclinedPayload;
        const contact = await this.contactResolver.resolve(payload.customerId!);
        // Payment declines get both channels - a declined card is
        // urgent enough to warrant an SMS in addition to email, unlike
        // a routine confirmation or cancellation.
        const email = orderCancelledEmail({ orderId: payload.orderId, customerId: payload.customerId!, reason: payload.reason });
        await this.emailProvider.send({ to: contact.email, subject: `Payment issue with order ${payload.orderId}`, body: email.body });
        if (contact.phone) {
          await this.smsProvider.send({ to: contact.phone, ...paymentDeclinedSms(payload) });
        }
        return;
      }
      default:
        return; // other event types on these topics aren't notification-worthy
    }
  }

  async onModuleDestroy() {
    await this.consumer?.disconnect();
  }
}
