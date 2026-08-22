import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { AuthorizeParams, AuthorizeResult, PaymentGateway, RefundResult } from './payment-gateway.interface';

/**
 * Real Stripe integration. Distinguishes CARD errors (a genuine business
 * decline - the customer's card was rejected) from everything else
 * (network failures, auth errors, rate limits), because those two cases
 * need opposite handling: a decline becomes a PaymentDeclined domain
 * event and the saga compensates; an infra error should propagate,
 * fail the Kafka message, and let redelivery retry the call -
 * mislabeling one as the other either hides a real outage as a business
 * failure, or permanently declines a payment that never actually ran.
 */
@Injectable()
export class StripeAdapter implements PaymentGateway {
  private readonly logger = new Logger(StripeAdapter.name);
  private readonly stripe: Stripe;

  constructor() {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY must be set to use StripeAdapter (use MockStripeAdapter for local dev).');
    }
    this.stripe = new Stripe(key, { apiVersion: '2024-04-10' });
  }

  async authorize(params: AuthorizeParams): Promise<AuthorizeResult> {
    try {
      const intent = await this.stripe.paymentIntents.create(
        {
          amount: params.amountCents,
          currency: 'usd',
          confirm: true,
          // Demo default payment method. In a real checkout, the client
          // tokenizes the card via Stripe Elements/Payment Element and
          // the resulting payment_method id is threaded through the
          // CreateOrder -> AuthorizePayment command chain instead.
          payment_method: 'pm_card_visa',
          off_session: true,
          metadata: { orderId: params.orderId, customerId: params.customerId },
        },
        { idempotencyKey: params.idempotencyKey },
      );

      if (intent.status === 'succeeded' || intent.status === 'requires_capture') {
        return { success: true, pspReference: intent.id };
      }

      // Reached a non-error terminal status that still isn't a success
      // (e.g. requires_action for 3DS) - treat as a decline rather than
      // silently leaving the payment in limbo.
      return { success: false, reason: `PaymentIntent ended in unhandled status: ${intent.status}` };
    } catch (err) {
      if (err instanceof Stripe.errors.StripeCardError) {
        this.logger.log(`Card declined for order ${params.orderId}: ${err.decline_code ?? err.code}`);
        return {
          success: false,
          declineCode: err.decline_code ?? err.code ?? 'card_error',
          reason: err.message,
        };
      }

      // StripeConnectionError, StripeAuthenticationError, StripeRateLimitError,
      // StripeAPIError, etc - all infrastructure problems. Rethrow so the
      // Kafka consumer does NOT commit the offset and this gets retried.
      this.logger.error(`Stripe infra error authorizing order ${params.orderId}: ${(err as Error).message}`);
      throw err;
    }
  }

  async refund(pspReference: string, amountCents: number, reason?: string): Promise<RefundResult> {
    const refund = await this.stripe.refunds.create({
      payment_intent: pspReference,
      amount: amountCents,
      reason: 'requested_by_customer',
      metadata: reason ? { reason } : undefined,
    });
    return { refundId: refund.id };
  }
}
