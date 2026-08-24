import { SagaDefinition } from '@saganova/saga-toolkit';
import {
  RESERVE_STOCK_COMMAND,
  ReserveStockCommandPayload,
  RELEASE_INVENTORY_COMMAND,
  AUTHORIZE_PAYMENT_COMMAND,
  AuthorizePaymentCommandPayload,
  InventoryEventType,
  PaymentEventType,
} from '@saganova/event-contracts';
import { buildReleaseInventoryCompensation } from './compensation/release-inventory.compensator';

export interface OrderFulfillmentLine {
  sku: string;
  qty: number;
}

/** Everything accumulated across the saga's lifetime, populated from ORDER_CREATED and then enriched by each step's success event payload. */
export interface OrderFulfillmentContext {
  orderId: string;
  customerId: string;
  lines: OrderFulfillmentLine[];
  amountCents: number;
  reservationId?: string;
  paymentId?: string;
  // Index signature required so this satisfies CompensationRegistry's
  // `TContext extends Record<string, unknown>` generic constraint - a
  // fixed-shape interface doesn't structurally match that constraint
  // without one, even though every declared property is itself fine.
  [key: string]: unknown;
}

/**
 * The actual checkout saga: reserve inventory, then authorize payment.
 * Order matters here for a business reason, not just a technical one -
 * holding inventory before charging the card means a card decline never
 * leaves inventory reserved for longer than the payment attempt itself,
 * and it's why RESERVE_INVENTORY has a compensation command but nothing
 * "before" it does.
 */
export const orderFulfillmentSaga: SagaDefinition<OrderFulfillmentContext> = {
  name: 'order-fulfillment',
  steps: [
    {
      name: 'RESERVE_INVENTORY',
      command: RESERVE_STOCK_COMMAND,
      buildCommandPayload: (ctx): ReserveStockCommandPayload => ({
        orderId: ctx.orderId,
        lines: ctx.lines,
      }),
      successEvent: InventoryEventType.INVENTORY_RESERVED,
      failureEvent: InventoryEventType.INVENTORY_RESERVATION_FAILED,
      // No compensationCommand: if THIS step is what failed, nothing was
      // ever reserved, so there is nothing to undo for it specifically.
    },
    {
      name: 'AUTHORIZE_PAYMENT',
      command: AUTHORIZE_PAYMENT_COMMAND,
      buildCommandPayload: (ctx): AuthorizePaymentCommandPayload => ({
        orderId: ctx.orderId,
        customerId: ctx.customerId,
        amountCents: ctx.amountCents,
      }),
      successEvent: PaymentEventType.PAYMENT_AUTHORIZED,
      failureEvent: PaymentEventType.PAYMENT_DECLINED,
      compensationCommand: RELEASE_INVENTORY_COMMAND,
      buildCompensationPayload: buildReleaseInventoryCompensation,
    },
  ],
};
