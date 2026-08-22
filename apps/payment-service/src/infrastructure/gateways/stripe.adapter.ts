import { Injectable, Logger } from '@nestjs/common';

export interface StripeAuthorizationInput {
  orderId: string;
  customerId: string;
  amountCents: number;
  correlationId: string;
}

export interface StripeAuthorizationResult {
  approved: boolean;
  paymentId: string;
  pspReference: string;
  declineCode?: string;
  reason?: string;
}

export interface StripeRefundInput {
  paymentId: string;
  amountCents: number;
  correlationId: string;
}

@Injectable()
export class StripeAdapter {
  private readonly logger = new Logger(StripeAdapter.name);

  async authorize(input: StripeAuthorizationInput): Promise<StripeAuthorizationResult> {
    if (process.env.STRIPE_MOCK_MODE !== 'false') {
      const shouldDecline =
        process.env.STRIPE_SIMULATE_DECLINE === 'true' ||
        Number(process.env.STRIPE_DECLINE_AT_OR_ABOVE_CENTS ?? Number.MAX_SAFE_INTEGER) <= input.amountCents;

      return {
        approved: !shouldDecline,
        paymentId: `pay_${input.orderId}`,
        pspReference: `pi_mock_${input.orderId}`,
        declineCode: shouldDecline ? 'card_declined' : undefined,
        reason: shouldDecline ? 'Mock Stripe adapter declined the authorization' : undefined,
      };
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;
    const paymentMethod = process.env.STRIPE_DEFAULT_PAYMENT_METHOD;
    if (!secretKey || !paymentMethod) {
      throw new Error(
        'Stripe live mode requires STRIPE_SECRET_KEY and STRIPE_DEFAULT_PAYMENT_METHOD to be configured',
      );
    }

    const params = new URLSearchParams({
      amount: input.amountCents.toString(),
      currency: process.env.STRIPE_CURRENCY ?? 'usd',
      confirm: 'true',
      capture_method: 'manual',
      payment_method: paymentMethod,
      description: `Order ${input.orderId}`,
      'metadata[orderId]': input.orderId,
      'metadata[customerId]': input.customerId,
      'metadata[correlationId]': input.correlationId,
    });

    const response = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    const body = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      this.logger.error(`Stripe authorization failed: ${JSON.stringify(body)}`);
      return {
        approved: false,
        paymentId: `pay_${input.orderId}`,
        pspReference: String(body.id ?? `pi_failed_${input.orderId}`),
        declineCode: String(body.code ?? 'stripe_error'),
        reason: String(body.message ?? 'Stripe returned a non-success status'),
      };
    }

    return {
      approved: String(body.status) === 'requires_capture' || String(body.status) === 'succeeded',
      paymentId: `pay_${input.orderId}`,
      pspReference: String(body.id),
      declineCode:
        String(body.status) === 'requires_payment_method' ? 'requires_payment_method' : undefined,
      reason:
        String(body.status) === 'requires_payment_method'
          ? 'Stripe requires a valid payment method for authorization'
          : undefined,
    };
  }

  async refund(input: StripeRefundInput): Promise<{ pspReference: string }> {
    if (process.env.STRIPE_MOCK_MODE !== 'false') {
      return { pspReference: `re_mock_${input.paymentId}` };
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error('Stripe live mode requires STRIPE_SECRET_KEY to be configured');
    }

    const params = new URLSearchParams({
      payment_intent: input.paymentId,
      amount: input.amountCents.toString(),
      reason: 'requested_by_customer',
      'metadata[correlationId]': input.correlationId,
    });

    const response = await fetch('https://api.stripe.com/v1/refunds', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    const body = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      this.logger.error(`Stripe refund failed: ${JSON.stringify(body)}`);
      throw new Error(String(body.message ?? 'Stripe refund failed'));
    }

    return { pspReference: String(body.id) };
  }
}
