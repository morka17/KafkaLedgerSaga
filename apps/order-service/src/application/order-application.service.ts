import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  CANCEL_ORDER_COMMAND,
  CommandEnvelope,
  CONFIRM_ORDER_COMMAND,
  ConfirmOrderCommandPayload,
  CREATE_ORDER_COMMAND,
  CreateOrderCommandPayload,
  EVENT_ENVELOPE_VERSION,
  OrderEventType,
  ORDER_TOPIC,
  makeEvent,
  CancelOrderCommandPayload,
} from '@saganova/event-contracts';
import { EventStoreRow, IdempotencyService, OutboxRelayScheduler } from '@saganova/database';
import { Repository } from 'typeorm';
import { OrderAggregate } from '../domain/order.aggregate';
import { OrderEntity } from '../infrastructure/postgres/order.entity';
import { OrderOutboxRow } from '../infrastructure/outbox/order-outbox.entity';

@Injectable()
export class OrderApplicationService {
  private readonly logger = new Logger(OrderApplicationService.name);

  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepository: Repository<OrderEntity>,
    @InjectRepository(EventStoreRow)
    private readonly eventStoreRepository: Repository<EventStoreRow>,
    @InjectRepository(OrderOutboxRow)
    private readonly outboxRepository: Repository<OrderOutboxRow>,
    private readonly idempotency: IdempotencyService,
    private readonly outboxRelay: OutboxRelayScheduler,
  ) {}

  async createOrder(command: CommandEnvelope<CreateOrderCommandPayload>): Promise<void> {
    if (command.type !== CREATE_ORDER_COMMAND) {
      throw new Error(`Unsupported command ${command.type}`);
    }

    if (await this.idempotency.isProcessed(command.id)) {
      return;
    }

    const totalCents = command.payload.items.reduce(
      (sum, item) => sum + item.qty * item.unitPriceCents,
      0,
    );

    const aggregate = OrderAggregate.create(command.payload.orderId, {
      ...command.payload,
      totalCents,
    });

    await this.persistAggregate(command, aggregate);
    this.logger.log(`Created order ${command.payload.orderId}`);
  }

  async confirmOrder(command: CommandEnvelope<ConfirmOrderCommandPayload>): Promise<void> {
    if (command.type !== CONFIRM_ORDER_COMMAND) {
      throw new Error(`Unsupported command ${command.type}`);
    }

    if (await this.idempotency.isProcessed(command.id)) {
      return;
    }

    const aggregate = await this.loadAggregate(command.payload.orderId);
    aggregate.confirm({
      orderId: command.payload.orderId,
      paymentId: command.payload.paymentId,
    });

    await this.persistAggregate(command, aggregate);
    this.logger.log(`Confirmed order ${command.payload.orderId}`);
  }

  async cancelOrder(command: CommandEnvelope<CancelOrderCommandPayload>): Promise<void> {
    if (command.type !== CANCEL_ORDER_COMMAND) {
      throw new Error(`Unsupported command ${command.type}`);
    }

    if (await this.idempotency.isProcessed(command.id)) {
      return;
    }

    const aggregate = await this.loadAggregate(command.payload.orderId);
    aggregate.cancel({
      orderId: command.payload.orderId,
      reason: command.payload.reason,
    });

    await this.persistAggregate(command, aggregate);
    this.logger.log(`Cancelled order ${command.payload.orderId}`);
  }

  async getOrder(orderId: string): Promise<OrderEntity> {
    const order = await this.orderRepository.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException(`Order ${orderId} was not found`);
    }
    return order;
  }

  async relayOutbox(): Promise<number> {
    return this.outboxRelay['tick' as never]();
  }

  private async loadAggregate(orderId: string): Promise<OrderAggregate> {
    const history = await this.eventStoreRepository.find({
      where: { aggregateId: orderId },
      order: { sequence: 'ASC' },
    });

    if (history.length === 0) {
      throw new NotFoundException(`Order ${orderId} was not found`);
    }

    return OrderAggregate.hydrate(
      OrderAggregate.empty(orderId),
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
    aggregate: OrderAggregate,
  ): Promise<void> {
    const uncommitted = aggregate.uncommittedEvents;
    const expectedVersion = aggregate.version - uncommitted.length;

    await this.orderRepository.manager.transaction(async (manager) => {
      const currentVersion =
        (await manager
          .createQueryBuilder(EventStoreRow, 'event')
          .select('MAX(event.sequence)', 'max')
          .where('event.aggregateId = :aggregateId', { aggregateId: aggregate.aggregateId })
          .getRawOne<{ max: string | null }>())?.max ?? null;

      const versionNumber = currentVersion ? Number(currentVersion) : 0;
      if (versionNumber !== expectedVersion) {
        throw new Error(`Order ${aggregate.aggregateId} was modified concurrently`);
      }

      const snapshot = aggregate.snapshot();
      await manager.save(OrderEntity, {
        id: snapshot.orderId,
        customerId: snapshot.customerId ?? undefined,
        items: snapshot.items,
        totalCents: snapshot.totalCents,
        status: snapshot.status,
        paymentId: snapshot.paymentId,
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
          aggregateType: 'order',
          sequence,
          type: event.type,
          payload: event.payload as Record<string, unknown>,
          correlationId: command.correlationId,
          occurredAt: new Date(envelope.occurredAt),
        });

        await manager.insert(OrderOutboxRow, {
          id: envelope.id,
          aggregateId: aggregate.aggregateId,
          topic: ORDER_TOPIC,
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
