import { AggregateRoot } from '@saganova/event-sourcing-core';
import {
  PaymentEventType,
  PaymentAuthorizedPayload,
  PaymentDeclinedPayload,
  PaymentRefundedPayload,
} from '@saganova/event-contracts';
import { PaymentStatus } from './payment-state';

export interface PaymentState {
  status: PaymentStatus;
  orderId: string;
  customerId?: string;
  amountCents: number;
  pspReference?: string;
  declineCode?: string;
  reason?: string;
}

const BLANK_STATE: PaymentState = {
  status: PaymentStatus.UNINITIALIZED,
  orderId: '',
  amountCents: 0,
};

/**
 * Thrown when a command targets a payment that's already terminal
 * (AUTHORIZED payments can only move to REFUNDED; DECLINED and REFUNDED
 * are dead ends). Handlers treat this as an idempotent no-op on
 * redelivery, never as a failure to retry.
 */
export class PaymentAlreadyFinalizedError extends Error {
  constructor(paymentId: string, currentStatus: PaymentStatus) {
    super(`Payment ${paymentId} is already ${currentStatus} - refusing to transition again.`);
    this.name = 'PaymentAlreadyFinalizedError';
  }
}

export class PaymentAggregate extends AggregateRoot<PaymentState> {
  private constructor(id: string, state: PaymentState) {
    super(id, state);
  }

  /** paymentId is minted by the handler BEFORE calling Stripe, so both a
   *  success and a decline can be recorded against the same identity. */
  static authorize(
    paymentId: string,
    orderId: string,
    customerId: string,
    amountCents: number,
    pspReference: string,
  ): PaymentAggregate {
    const aggregate = new PaymentAggregate(paymentId, { ...BLANK_STATE });
    const payload: PaymentAuthorizedPayload = { paymentId, orderId, amountCents, pspReference };
    aggregate.apply(PaymentEventType.PAYMENT_AUTHORIZED, payload);
    return aggregate;
  }

  static decline(paymentId: string, orderId: string, declineCode: string, reason: string): PaymentAggregate {
    const aggregate = new PaymentAggregate(paymentId, { ...BLANK_STATE });
    const payload: PaymentDeclinedPayload = { paymentId, orderId, declineCode, reason };
    aggregate.apply(PaymentEventType.PAYMENT_DECLINED, payload);
    return aggregate;
  }

  static blank(paymentId: string): PaymentAggregate {
    return new PaymentAggregate(paymentId, { ...BLANK_STATE });
  }

  /** Compensating transaction - called by the saga orchestrator's RefundPayment command. */
  refund(reason?: string): void {
    if (this.state.status !== PaymentStatus.AUTHORIZED) {
      throw new PaymentAlreadyFinalizedError(this.aggregateId, this.state.status);
    }
    const payload: PaymentRefundedPayload = {
      paymentId: this.aggregateId,
      orderId: this.state.orderId,
      amountCents: this.state.amountCents,
      reason,
    };
    this.apply(PaymentEventType.PAYMENT_REFUNDED, payload);
  }

  get status(): PaymentStatus {
    return this.state.status;
  }

  get snapshot(): Readonly<PaymentState> {
    return this.state;
  }

  protected when(eventType: string, payload: unknown): void {
    switch (eventType) {
      case PaymentEventType.PAYMENT_AUTHORIZED: {
        const p = payload as PaymentAuthorizedPayload;
        this.state = {
          ...this.state,
          status: PaymentStatus.AUTHORIZED,
          orderId: p.orderId,
          amountCents: p.amountCents,
          pspReference: p.pspReference,
        };
        return;
      }
      case PaymentEventType.PAYMENT_DECLINED: {
        const p = payload as PaymentDeclinedPayload;
        this.state = {
          ...this.state,
          status: PaymentStatus.DECLINED,
          orderId: p.orderId,
          declineCode: p.declineCode,
          reason: p.reason,
        };
        return;
      }
      case PaymentEventType.PAYMENT_REFUNDED: {
        const p = payload as PaymentRefundedPayload;
        this.state = { ...this.state, status: PaymentStatus.REFUNDED, reason: p.reason ?? this.state.reason };
        return;
      }
      default:
        throw new Error(`PaymentAggregate cannot apply unknown event type "${eventType}"`);
    }
  }
}
