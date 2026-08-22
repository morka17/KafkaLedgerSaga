import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AuthorizeParams, AuthorizeResult, PaymentGateway, RefundResult } from './payment-gateway.interface';

/**
 * Used when STRIPE_SECRET_KEY is unset (local dev, CI, e2e tests) so the
 * full checkout saga - including the failure/compensation path - is
 * exercisable without real Stripe credentials.
 *
 * Deterministic by design: any customerId of "cust_DECLINE" always
 * declines (this is exactly the id tools/scripts/seed-dev-data.ts prints
 * as the "trigger a decline" test customer), everything else succeeds.
 */
@Injectable()
export class MockStripeAdapter implements PaymentGateway {
  private readonly logger = new Logger(MockStripeAdapter.name);

  async authorize(params: AuthorizeParams): Promise<AuthorizeResult> {
    this.logger.warn(`Using MOCK Stripe adapter for order ${params.orderId} - no real charge is made.`);

    if (params.customerId === 'cust_DECLINE') {
      return {
        success: false,
        declineCode: 'generic_decline',
        reason: 'Your card was declined (simulated by MockStripeAdapter).',
      };
    }

    return { success: true, pspReference: `mock_pi_${randomUUID()}` };
  }

  async refund(pspReference: string, amountCents: number): Promise<RefundResult> {
    this.logger.warn(`Simulating refund of ${amountCents} cents for ${pspReference} (mock adapter).`);
    return { refundId: `mock_re_${randomUUID()}` };
  }
}
