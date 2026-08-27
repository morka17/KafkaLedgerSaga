import 'reflect-metadata';
import { validateSync } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  ORDER_TOPIC,
  OrderEventType,
  OrderCreatedPayload,
  OrderConfirmedPayload,
  OrderCancelledPayload,
  makeEvent,
} from '@saganova/event-contracts';

/**
 * Each spec here answers one question: "if order-service published THIS
 * exact shape, would every consumer's `class-validator` decorators
 * accept it?" A failure here means either order-service or a downstream
 * consumer's expectations have silently drifted from the shared contract
 * class - exactly the class of bug Nx's affected-graph won't catch,
 * since editing event-contracts doesn't necessarily touch code any
 * specific consumer imports at build time.
 */
describe('order.events contract', () => {
  it('OrderCreated: a well-formed payload passes validation', () => {
    const payload = plainToInstance(OrderCreatedPayload, {
      orderId: '11111111-1111-4111-8111-111111111111',
      customerId: '22222222-2222-4222-8222-222222222222',
      items: [{ sku: 'SKU-42', qty: 2, unitPriceCents: 1999 }],
      totalCents: 3998,
    });
    expect(validateSync(payload)).toHaveLength(0);
  });

  it('OrderCreated: rejects a missing customerId', () => {
    const payload = plainToInstance(OrderCreatedPayload, {
      orderId: '11111111-1111-4111-8111-111111111111',
      items: [{ sku: 'SKU-42', qty: 2, unitPriceCents: 1999 }],
      totalCents: 3998,
    });
    const errors = validateSync(payload);
    expect(errors.some((e) => e.property === 'customerId')).toBe(true);
  });

  it('OrderCreated: rejects a negative quantity line item', () => {
    const payload = plainToInstance(OrderCreatedPayload, {
      orderId: '11111111-1111-4111-8111-111111111111',
      customerId: '22222222-2222-4222-8222-222222222222',
      items: [{ sku: 'SKU-42', qty: -1, unitPriceCents: 1999 }],
      totalCents: 3998,
    });
    expect(validateSync(payload, { forbidUnknownValues: true }).length).toBeGreaterThan(0);
  });

  it('OrderConfirmed: carries customerId (required for notification-service to resolve a recipient - see docs/adr and NotificationKafkaConsumer)', () => {
    const payload = plainToInstance(OrderConfirmedPayload, {
      orderId: '11111111-1111-4111-8111-111111111111',
      customerId: '22222222-2222-4222-8222-222222222222',
      paymentId: '33333333-3333-4333-8333-333333333333',
    });
    expect(validateSync(payload)).toHaveLength(0);
  });

  it('OrderCancelled: carries customerId for the same reason', () => {
    const payload = plainToInstance(OrderCancelledPayload, {
      orderId: '11111111-1111-4111-8111-111111111111',
      customerId: '22222222-2222-4222-8222-222222222222',
      reason: 'Insufficient stock',
    });
    expect(validateSync(payload)).toHaveLength(0);
  });

  it('every OrderEventType value is a versioned, dot-namespaced string (contract-naming convention)', () => {
    for (const value of Object.values(OrderEventType)) {
      expect(value).toMatch(/^[a-z]+(\.[a-z_]+)+\.v\d+$/);
    }
  });

  it('ORDER_TOPIC matches the name declared in infra/kafka-topics/topics.yaml', () => {
    expect(ORDER_TOPIC).toBe('order.events');
  });

  it('makeEvent() produces a well-formed envelope around an OrderCreated payload', () => {
    const payload: OrderCreatedPayload = {
      orderId: '11111111-1111-4111-8111-111111111111',
      customerId: '22222222-2222-4222-8222-222222222222',
      items: [{ sku: 'SKU-42', qty: 1, unitPriceCents: 500 }],
      totalCents: 500,
    };
    const envelope = makeEvent({
      type: OrderEventType.ORDER_CREATED,
      aggregateId: payload.orderId,
      sequence: 1,
      correlationId: 'corr-123',
      payload,
    });

    expect(envelope.id).toBeTruthy();
    expect(envelope.type).toBe(OrderEventType.ORDER_CREATED);
    expect(envelope.aggregateId).toBe(payload.orderId);
    expect(envelope.sequence).toBe(1);
    expect(envelope.correlationId).toBe('corr-123');
    expect(() => new Date(envelope.occurredAt).toISOString()).not.toThrow();
    expect(envelope.payload).toEqual(payload);
  });
});
