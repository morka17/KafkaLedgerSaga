import { AggregateRoot } from '@saganova/event-sourcing-core';
import {
  OrderEventType,
  OrderCreatedPayload,
  OrderConfirmedPayload,
  OrderCancelledPayload,
  OrderLineItem,
} from '@saganova/event-contracts';
import { OrderStatus } from './order-state';

export interface OrderState {
  status: OrderStatus;
  customerId: string;
  items: OrderLineItem[];
  totalCents: number;
  paymentId?: string;
  cancelReason?: string;
}

const BLANK_STATE: OrderState = {
  status: OrderStatus.UNINITIALIZED,
  customerId: '',
  items: [],
  totalCents: 0,
};

/**
 * Thrown when a command targets an order that's already in a terminal
 * state. Command handlers treat this as an IDEMPOTENT NO-OP, not a
 * failure - Kafka's at-least-once delivery means ConfirmOrder/CancelOrder
 * can legitimately arrive twice for the same order.
 */
export class OrderAlreadyFinalizedError extends Error {
  constructor(orderId: string, currentStatus: OrderStatus) {
    super(`Order ${orderId} is already ${currentStatus} - refusing to transition again.`);
    this.name = 'OrderAlreadyFinalizedError';
  }
}

export class OrderNotFoundError extends Error {
  constructor(orderId: string) {
    super(`No order found with id ${orderId}`);
    this.name = 'OrderNotFoundError';
  }
}

export class OrderAggregate extends AggregateRoot<OrderState> {
  private constructor(id: string, state: OrderState) {
    super(id, state);
  }

  /** Creates a brand-new order and immediately applies ORDER_CREATED. */
  static createNew(orderId: string, customerId: string, items: OrderLineItem[]): OrderAggregate {
    const totalCents = items.reduce((sum, i) => sum + i.qty * i.unitPriceCents, 0);
    const aggregate = new OrderAggregate(orderId, { ...BLANK_STATE });

    const payload: OrderCreatedPayload = { orderId, customerId, items, totalCents };
    aggregate.apply(OrderEventType.ORDER_CREATED, payload);

    return aggregate;
  }

  /** Used by the repository to rebuild an aggregate from its stored event stream. */
  static blank(orderId: string): OrderAggregate {
    return new OrderAggregate(orderId, { ...BLANK_STATE });
  }

  confirm(paymentId: string): void {
    if (this.state.status !== OrderStatus.CREATED) {
      throw new OrderAlreadyFinalizedError(this.aggregateId, this.state.status);
    }
    const payload: OrderConfirmedPayload = { orderId: this.aggregateId, paymentId };
    this.apply(OrderEventType.ORDER_CONFIRMED, payload);
  }

  cancel(reason: string): void {
    if (this.state.status === OrderStatus.CANCELLED || this.state.status === OrderStatus.CONFIRMED) {
      throw new OrderAlreadyFinalizedError(this.aggregateId, this.state.status);
    }
    const payload: OrderCancelledPayload = { orderId: this.aggregateId, reason };
    this.apply(OrderEventType.ORDER_CANCELLED, payload);
  }

  get status(): OrderStatus {
    return this.state.status;
  }

  get snapshot(): Readonly<OrderState> {
    return this.state;
  }

  protected when(eventType: string, payload: unknown): void {
    switch (eventType) {
      case OrderEventType.ORDER_CREATED: {
        const p = payload as OrderCreatedPayload;
        this.state = {
          status: OrderStatus.CREATED,
          customerId: p.customerId,
          items: p.items,
          totalCents: p.totalCents,
        };
        return;
      }
      case OrderEventType.ORDER_CONFIRMED: {
        const p = payload as OrderConfirmedPayload;
        this.state = { ...this.state, status: OrderStatus.CONFIRMED, paymentId: p.paymentId };
        return;
      }
      case OrderEventType.ORDER_CANCELLED: {
        const p = payload as OrderCancelledPayload;
        this.state = { ...this.state, status: OrderStatus.CANCELLED, cancelReason: p.reason };
        return;
      }
      default:
        throw new Error(`OrderAggregate cannot apply unknown event type "${eventType}"`);
    }
  }
}
