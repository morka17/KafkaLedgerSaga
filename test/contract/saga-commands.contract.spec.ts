import 'reflect-metadata';
import { validateSync } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  SAGA_COMMANDS_TOPIC,
  CREATE_ORDER_COMMAND,
  CreateOrderCommandPayload,
  RESERVE_STOCK_COMMAND,
  ReserveStockCommandPayload,
  RELEASE_INVENTORY_COMMAND,
  ReleaseInventoryCommandPayload,
  AUTHORIZE_PAYMENT_COMMAND,
  AuthorizePaymentCommandPayload,
  REFUND_PAYMENT_COMMAND,
  RefundPaymentCommandPayload,
  CONFIRM_ORDER_COMMAND,
  ConfirmOrderCommandPayload,
  CANCEL_ORDER_COMMAND,
  makeCommand,
} from '@saganova/event-contracts';

const ORDER_ID = '11111111-1111-4111-8111-111111111111';
const CUSTOMER_ID = '22222222-2222-4222-8222-222222222222';
const PAYMENT_ID = '33333333-3333-4333-8333-333333333333';
const RESERVATION_ID = '44444444-4444-4444-8444-444444444444';

/**
 * Every command in this file is one @saganova/saga-toolkit's
 * order-fulfillment.saga-definition.ts either publishes as a forward
 * step or as a compensation - see docs/sagas/order-fulfillment-saga.md's
 * step table for the authoritative mapping. All of them travel on the
 * single shared SAGA_COMMANDS_TOPIC, keyed by orderId.
 */
describe('saga.commands contract', () => {
  it('SAGA_COMMANDS_TOPIC matches infra/kafka-topics/topics.yaml', () => {
    expect(SAGA_COMMANDS_TOPIC).toBe('saga.commands');
  });

  it('CreateOrder: well-formed payload passes validation', () => {
    const payload = plainToInstance(CreateOrderCommandPayload, {
      orderId: ORDER_ID,
      customerId: CUSTOMER_ID,
      items: [{ sku: 'SKU-42', qty: 1, unitPriceCents: 1999 }],
    });
    expect(validateSync(payload)).toHaveLength(0);
  });

  it('ReserveStock: well-formed payload passes validation (forward step 1)', () => {
    const payload = plainToInstance(ReserveStockCommandPayload, {
      orderId: ORDER_ID,
      lines: [{ sku: 'SKU-42', qty: 1 }],
    });
    expect(validateSync(payload)).toHaveLength(0);
  });

  it('ReleaseInventory: well-formed payload passes validation (compensation for step 1, fired when step 2 fails)', () => {
    const payload = plainToInstance(ReleaseInventoryCommandPayload, {
      orderId: ORDER_ID,
      reservationId: RESERVATION_ID,
    });
    expect(validateSync(payload)).toHaveLength(0);
  });

  it('AuthorizePayment: well-formed payload passes validation (forward step 2)', () => {
    const payload = plainToInstance(AuthorizePaymentCommandPayload, {
      orderId: ORDER_ID,
      customerId: CUSTOMER_ID,
      amountCents: 1999,
    });
    expect(validateSync(payload)).toHaveLength(0);
  });

  it('RefundPayment: well-formed payload passes validation (compensation, not currently reachable by the 2-step saga - see saga-definition.ts comment - but must remain valid for when a future step is added after payment)', () => {
    const payload = plainToInstance(RefundPaymentCommandPayload, {
      orderId: ORDER_ID,
      paymentId: PAYMENT_ID,
      amountCents: 1999,
    });
    expect(validateSync(payload)).toHaveLength(0);
  });

  it('ConfirmOrder: well-formed payload passes validation (terminal command on saga COMPLETED)', () => {
    const payload = plainToInstance(ConfirmOrderCommandPayload, {
      orderId: ORDER_ID,
      paymentId: PAYMENT_ID,
    });
    expect(validateSync(payload)).toHaveLength(0);
  });

  it('every saga command constant is a unique, versioned, dot-namespaced string', () => {
    const commands = [
      CREATE_ORDER_COMMAND,
      RESERVE_STOCK_COMMAND,
      RELEASE_INVENTORY_COMMAND,
      AUTHORIZE_PAYMENT_COMMAND,
      REFUND_PAYMENT_COMMAND,
      CONFIRM_ORDER_COMMAND,
      CANCEL_ORDER_COMMAND,
    ];
    expect(new Set(commands).size).toBe(commands.length); // no accidental duplicate command-type strings
    for (const c of commands) {
      expect(c).toMatch(/^[a-z]+(\.[a-z_]+)+\.v\d+$/);
    }
  });

  it('makeCommand() produces a well-formed envelope, keyable by orderId', () => {
    const payload: ReserveStockCommandPayload = { orderId: ORDER_ID, lines: [{ sku: 'SKU-42', qty: 1 }] };
    const command = makeCommand({ type: RESERVE_STOCK_COMMAND, correlationId: 'corr-abc', payload });

    expect(command.id).toBeTruthy();
    expect(command.type).toBe(RESERVE_STOCK_COMMAND);
    expect(command.correlationId).toBe('corr-abc');
    expect(() => new Date(command.issuedAt).toISOString()).not.toThrow();
    // Every service's Kafka producer partitions by (payload as {orderId}).orderId
    // (see e.g. SagaCommandProducer.publish) - a command missing that field
    // on its payload would silently fall back to random partitioning and
    // break per-order ordering guarantees.
    expect((command.payload as { orderId: string }).orderId).toBe(ORDER_ID);
  });
});
