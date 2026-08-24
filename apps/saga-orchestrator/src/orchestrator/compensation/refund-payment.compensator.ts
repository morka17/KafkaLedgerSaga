import { RefundPaymentCommandPayload } from '@saganova/event-contracts';
import { OrderFulfillmentContext } from '../order-fulfillment.saga-definition';

/**
 * Builds the payload for refunding an authorized payment. In the current
 * two-step saga (reserve inventory -> authorize payment), payment is the
 * LAST step, so this compensator is reserved for future steps added
 * after payment (e.g. loyalty points, shipping label purchase) that
 * could still fail and require undoing the charge.
 */
export function buildRefundPaymentCompensation(ctx: OrderFulfillmentContext): RefundPaymentCommandPayload {
  if (!ctx.paymentId) {
    throw new Error(`Cannot refund payment for order ${ctx.orderId}: no paymentId in saga context.`);
  }
  return { orderId: ctx.orderId, paymentId: ctx.paymentId, amountCents: ctx.amountCents };
}
