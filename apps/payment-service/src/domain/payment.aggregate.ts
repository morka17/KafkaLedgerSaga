import { AggregateRoot } from '@saganova/event-sourcing-core';
import {
  PaymentAuthorizedPayload,
  PaymentDeclinedPayload,
  PaymentEventType,
  PaymentRefundedPayload,
} from '@saganova/event-contracts';

type PaymentStatus = 'PENDING' | 'AUTHORIZED' | 'DECLINED' | 'REFUNDED';

interface PaymentState {
  orderId?: string;
  customerId?: string;
  amountCents: number;
  status: PaymentStatus;
  pspReference?: string;
  declineCode?: string;
  reason?: string;
}

const initialState = (): PaymentState => ({
  amountCents: 0,
  status: 'PENDING',
});

export class PaymentAggregate extends AggregateRoot<PaymentState> {
  private constructor(id: string, state: PaymentState = initialState()) {
    super(id, state);
  }

  static empty(paymentId: string): PaymentAggregate {
    return new PaymentAggregate(paymentId);
  }

  authorize(payload: PaymentAuthorizedPayload): void {
    if (this.state.status === 'AUTHORIZED') {
      return;
    }
    if (this.state.status === 'REFUNDED') {
      throw new Error(`Payment ${this.aggregateId} has already been refunded`);
    }
    this.apply(PaymentEventType.PAYMENT_AUTHORIZED, payload);
  }

  decline(payload: PaymentDeclinedPayload): void {
    if (this.state.status === 'DECLINED') {
      return;
    }
    if (this.state.status === 'AUTHORIZED') {
      throw new Error(`Payment ${this.aggregateId} has already been authorized`);
    }
    this.apply(PaymentEventType.PAYMENT_DECLINED, payload);
  }

  refund(payload: PaymentRefundedPayload): void {
    if (this.state.status === 'REFUNDED') {
      return;
    }
    this.apply(PaymentEventType.PAYMENT_REFUNDED, payload);
  }

  snapshot() {
    return {
      paymentId: this.aggregateId,
      orderId: this.state.orderId ?? null,
      customerId: this.state.customerId ?? null,
      amountCents: this.state.amountCents,
      status: this.state.status,
      pspReference: this.state.pspReference ?? null,
      declineCode: this.state.declineCode ?? null,
      reason: this.state.reason ?? null,
    };
  }

  protected when(eventType: string, payload: unknown): void {
    switch (eventType) {
      case PaymentEventType.PAYMENT_AUTHORIZED: {
        const event = payload as PaymentAuthorizedPayload;
        this.state.orderId = event.orderId;
        this.state.amountCents = event.amountCents;
        this.state.pspReference = event.pspReference;
        this.state.status = 'AUTHORIZED';
        this.state.declineCode = undefined;
        this.state.reason = undefined;
        return;
      }
      case PaymentEventType.PAYMENT_DECLINED: {
        const event = payload as PaymentDeclinedPayload;
        this.state.orderId = event.orderId;
        this.state.declineCode = event.declineCode;
        this.state.reason = event.reason;
        this.state.status = 'DECLINED';
        return;
      }
      case PaymentEventType.PAYMENT_REFUNDED: {
        const event = payload as PaymentRefundedPayload;
        this.state.orderId = event.orderId;
        this.state.amountCents = event.amountCents;
        this.state.reason = event.reason;
        this.state.status = 'REFUNDED';
        return;
      }
      default:
        return;
    }
  }
}
