import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  AUTHORIZE_PAYMENT_COMMAND,
  AuthorizePaymentCommandPayload,
  CommandEnvelope,
  EVENT_ENVELOPE_VERSION,
  PAYMENT_TOPIC,
  PaymentAuthorizedPayload,
  PaymentDeclinedPayload,
  PaymentEventType,
  PaymentRefundedPayload,
  REFUND_PAYMENT_COMMAND,
  RefundPaymentCommandPayload,
  makeEvent,
} from '@saganova/event-contracts';
import { EventStoreRow, IdempotencyService, OutboxRelayScheduler, ProcessedMessageRow } from '@saganova/database';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { PaymentAggregate } from '../domain/payment.aggregate';
import { StripeAdapter } from '../infrastructure/gateways/stripe.adapter';
import { PaymentEntity } from '../infrastructure/postgres/payment.entity';
import { PaymentOutboxRow } from '../infrastructure/outbox/payment-outbox.entity';

@Injectable()
export class PaymentApplicationService {
  private readonly logger = new Logger(PaymentApplicationService.name);

  constructor(
    @InjectRepository(PaymentEntity)
    private readonly paymentRepository: Repository<PaymentEntity>,
    @InjectRepository(EventStoreRow)
    private readonly eventStoreRepository: Repository<EventStoreRow>,
    @InjectRepository(PaymentOutboxRow)
    private readonly outboxRepository: Repository<PaymentOutboxRow>,
    @InjectRepository(ProcessedMessageRow)
    private readonly processedRepository: Repository<ProcessedMessageRow>,
    private readonly idempotency: IdempotencyService,
    private readonly stripe: StripeAdapter,
    private readonly outboxRelay: OutboxRelayScheduler,
  ) {}

  async authorizePayment(command: CommandEnvelope<AuthorizePaymentCommandPayload>): Promise<void> {
    if (command.type !== AUTHORIZE_PAYMENT_COMMAND) {
      throw new Error(`Unsupported command ${command.type}`);
    }

    if (await this.idempotency.isProcessed(command.id)) {
      return;
    }

    const paymentId = randomUUID();
    const authorization = await this.stripe.authorize({
      orderId: command.payload.orderId,
      customerId: command.payload.customerId,
      amountCents: command.payload.amountCents,
      correlationId: command.correlationId,
    });

    const aggregate = PaymentAggregate.empty(paymentId);
    if (authorization.approved) {
      const payload: PaymentAuthorizedPayload = {
        paymentId,
        orderId: command.payload.orderId,
        amountCents: command.payload.amountCents,
        pspReference: authorization.pspReference,
      };
      aggregate.authorize(payload);
    } else {
      const payload: PaymentDeclinedPayload = {
        paymentId,
        orderId: command.payload.orderId,
        declineCode: authorization.declineCode ?? 'declined',
        reason: authorization.reason ?? 'Stripe declined the authorization',
      };
      aggregate.decline(payload);
    }

    await this.persistAggregate(command, aggregate);
    this.logger.log(`Processed payment authorization for order ${command.payload.orderId}`);
  }

  async refundPayment(command: CommandEnvelope<RefundPaymentCommandPayload>): Promise<void> {
    if (command.type !== REFUND_PAYMENT_COMMAND) {
      throw new Error(`Unsupported command ${command.type}`);
    }

    if (await this.idempotency.isProcessed(command.id)) {
      return;
    }

    const aggregate = await this.loadAggregate(command.payload.paymentId);
    await this.stripe.refund({
      paymentId: command.payload.paymentId,
      amountCents: command.payload.amountCents,
      correlationId: command.correlationId,
    });

    const payload: PaymentRefundedPayload = {
      paymentId: command.payload.paymentId,
      orderId: command.payload.orderId,
      amountCents: command.payload.amountCents,
      reason: 'Saga compensation',
    };
    aggregate.refund(payload);

    await this.persistAggregate(command, aggregate);
    this.logger.log(`Refunded payment ${command.payload.paymentId}`);
  }

  private async loadAggregate(paymentId: string): Promise<PaymentAggregate> {
    const history = await this.eventStoreRepository.find({
      where: { aggregateId: paymentId },
      order: { sequence: 'ASC' },
    });

    if (history.length === 0) {
      throw new NotFoundException(`Payment ${paymentId} was not found`);
    }

    return PaymentAggregate.hydrate(
      PaymentAggregate.empty(paymentId),
      history.map((row) => ({
        aggregateId: row.aggregateId,
        aggregateType: row.aggregateType,
        sequence: row.sequence,
        type: row.type,
        payload: row.payload,
        correlationId: row.correlationId,
        occurredAt: row.occurredAt,
      })),
    );
  }

  private async persistAggregate<TPayload>(
    command: CommandEnvelope<TPayload>,
    aggregate: PaymentAggregate,
  ): Promise<void> {
    const uncommitted = aggregate.uncommittedEvents;
    const expectedVersion = aggregate.version - uncommitted.length;

    await this.paymentRepository.manager.transaction(async (manager) => {
      const currentVersion =
        (await manager
          .createQueryBuilder(EventStoreRow, 'event')
          .select('MAX(event.sequence)', 'max')
          .where('event.aggregateId = :aggregateId', { aggregateId: aggregate.aggregateId })
          .getRawOne<{ max: string | null }>())?.max ?? null;

      const versionNumber = currentVersion ? Number(currentVersion) : 0;
      if (versionNumber !== expectedVersion) {
        throw new Error(`Payment ${aggregate.aggregateId} was modified concurrently`);
      }

      const snapshot = aggregate.snapshot();
      await manager.save(PaymentEntity, {
        id: snapshot.paymentId,
        orderId: snapshot.orderId ?? undefined,
        customerId: snapshot.customerId,
        amountCents: snapshot.amountCents,
        status: snapshot.status,
        pspReference: snapshot.pspReference,
        declineCode: snapshot.declineCode,
        reason: snapshot.reason,
      });

      let sequence = expectedVersion;
      for (const event of uncommitted) {
        sequence += 1;
        const envelope = makeEvent({
          type: event.type,
          aggregateId: aggregate.aggregateId,
          sequence,
          correlationId: command.correlationId,
          causationId: command.id,
          version: EVENT_ENVELOPE_VERSION,
          payload: event.payload,
        });

        await manager.insert(EventStoreRow, {
          id: envelope.id,
          aggregateId: aggregate.aggregateId,
          aggregateType: 'payment',
          sequence,
          type: event.type,
          payload: event.payload as Record<string, unknown>,
          correlationId: command.correlationId,
          occurredAt: new Date(envelope.occurredAt),
        });

        await manager.insert(PaymentOutboxRow, {
          id: envelope.id,
          aggregateId: aggregate.aggregateId,
          topic: PAYMENT_TOPIC,
          eventType: event.type,
          payload: envelope as unknown as Record<string, unknown>,
          correlationId: command.correlationId,
          publishedAt: null,
          publishAttempts: 0,
        });
      }

      await this.idempotency.markProcessed(manager, command.id, command.type);
    });

    aggregate.markEventsAsCommitted();
  }
}
