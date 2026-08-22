import { AggregateRoot } from '@saganova/event-sourcing-core';
import {
  OrderCancelledPayload,
  OrderConfirmedPayload,
  OrderCreatedPayload,
  OrderEventType,
} from '@saganova/event-contracts';
import { OrderState } from './order-state';

interface OrderAggregateState {
  customerId?: string;
  items: OrderCreatedPayload['items'];
  totalCents: number;
  status: OrderState;
  paymentId?: string;
  reason?: string;
}

const initialState = (): OrderAggregateState => ({
  items: [],
  totalCents: 0,
  status: OrderState.CREATED,
});

export class OrderAggregate extends AggregateRoot<OrderAggregateState> {
  private constructor(id: string, state: OrderAggregateState = initialState()) {
    super(id, state);
  }

  static create(orderId: string, payload: OrderCreatedPayload): OrderAggregate {
    const aggregate = new OrderAggregate(orderId);
    aggregate.apply(OrderEventType.ORDER_CREATED, payload);
    return aggregate;
  }

  static empty(orderId: string): OrderAggregate {
    return new OrderAggregate(orderId);
  }

  confirm(payload: OrderConfirmedPayload): void {
    if (this.state.status === OrderState.CANCELLED) {
      throw new Error(`Order ${this.aggregateId} is already cancelled`);
    }
    if (this.state.status === OrderState.CONFIRMED) {
      return;
    }

    this.apply(OrderEventType.ORDER_CONFIRMED, payload);
  }

  cancel(payload: OrderCancelledPayload): void {
    if (this.state.status === OrderState.CONFIRMED) {
      throw new Error(`Order ${this.aggregateId} is already confirmed`);
    }
    if (this.state.status === OrderState.CANCELLED) {
      return;
    }

    this.apply(OrderEventType.ORDER_CANCELLED, payload);
  }

  snapshot() {
    return {
      orderId: this.aggregateId,
      customerId: this.state.customerId ?? null,
      items: this.state.items,
      totalCents: this.state.totalCents,
      status: this.state.status,
      paymentId: this.state.paymentId ?? null,
      reason: this.state.reason ?? null,
    };
  }

  protected when(eventType: string, payload: unknown): void {
    switch (eventType) {
      case OrderEventType.ORDER_CREATED: {
        const event = payload as OrderCreatedPayload;
        this.state.customerId = event.customerId;
        this.state.items = event.items;
        this.state.totalCents = event.totalCents;
        this.state.status = OrderState.PENDING_PAYMENT;
        return;
      }
      case OrderEventType.ORDER_CONFIRMED: {
        const event = payload as OrderConfirmedPayload;
        this.state.paymentId = event.paymentId;
        this.state.status = OrderState.CONFIRMED;
        this.state.reason = undefined;
        return;
      }
      case OrderEventType.ORDER_CANCELLED: {
        const event = payload as OrderCancelledPayload;
        this.state.reason = event.reason;
        this.state.status = OrderState.CANCELLED;
        return;
      }
      default:
        return;
    }
  }
}
