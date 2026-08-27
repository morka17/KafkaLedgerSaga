import 'reflect-metadata';
import { validateSync } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  PAYMENT_TOPIC,
  PaymentEventType,
  PaymentAuthorizedPayload,
  PaymentDeclinedPayload,
  PaymentRefundedPayload,
} from '@saganova/event-contracts';

const ORDER_ID = '11111111-1111-4111-8111-111111111111';
const CUSTOMER_ID = '22222222-2222-4222-8222-222222222222';
const PAYMENT_ID = '33333333-3333-4333-8333-333333333333';

describe('payment.events contract', () => {
  it('PaymentAuthorized: a well-formed payload passes validation', () => {
    const payload = plainToInstance(PaymentAuthorizedPayload, {
      paymentId: PAYMENT_ID,
      orderId: ORDER_ID,
      amountCents: 3998,
      pspReference: 'pi_mock_123',
    });
    expect(validateSync(payload)).toHaveLength(0);
  });

  it('PaymentAuthorized: rejects a zero or negative amount (StripeAdapter/MockStripeAdapter never produce this, but the contract must reject it independently of either implementation)', () => {
    const payload = plainToInstance(PaymentAuthorizedPayload, {
      paymentId: PAYMENT_ID,
      orderId: ORDER_ID,
      amountCents: 0,
      pspReference: 'pi_mock_123',
    });
    expect(validateSync(payload).some((e) => e.property === 'amountCents')).toBe(true);
  });

  it('PaymentDeclined: carries customerId (added specifically so notification-service can resolve a recipient without a customer-profile service - see docs/adr)', () => {
    const payload = plainToInstance(PaymentDeclinedPayload, {
      paymentId: PAYMENT_ID,
      orderId: ORDER_ID,
      customerId: CUSTOMER_ID,
      declineCode: 'generic_decline',
      reason: 'Your card was declined.',
    });
    expect(validateSync(payload)).toHaveLength(0);
  });

  it('PaymentDeclined: rejects a missing declineCode', () => {
    const payload = plainToInstance(PaymentDeclinedPayload, {
      paymentId: PAYMENT_ID,
      orderId: ORDER_ID,
      customerId: CUSTOMER_ID,
      reason: 'Your card was declined.',
    });
    expect(validateSync(payload).some((e) => e.property === 'declineCode')).toBe(true);
  });

  it('PaymentRefunded: reason is optional (RefundPaymentHandler always supplies one, but the contract must not require it)', () => {
    const payload = plainToInstance(PaymentRefundedPayload, {
      paymentId: PAYMENT_ID,
      orderId: ORDER_ID,
      amountCents: 3998,
    });
    expect(validateSync(payload)).toHaveLength(0);
  });

  it('PAYMENT_TOPIC matches infra/kafka-topics/topics.yaml', () => {
    expect(PAYMENT_TOPIC).toBe('payment.events');
  });

  it('every PaymentEventType value follows the versioned dot-namespace convention', () => {
    for (const value of Object.values(PaymentEventType)) {
      expect(value).toMatch(/^[a-z]+(\.[a-z_]+)+\.v\d+$/);
    }
  });
});
