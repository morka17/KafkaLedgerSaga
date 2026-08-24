import { ReleaseInventoryCommandPayload } from '@saganova/event-contracts';
import { OrderFulfillmentContext } from '../order-fulfillment.saga-definition';

/**
 * Builds the payload for undoing the inventory reservation step. Called
 * by CompensationRegistry only when a LATER step (payment) has failed -
 * never on the inventory step's own failure, since a failed reservation
 * never took effect and has nothing to undo.
 */
export function buildReleaseInventoryCompensation(ctx: OrderFulfillmentContext): ReleaseInventoryCommandPayload {
  if (!ctx.reservationId) {
    throw new Error(
      `Cannot release inventory for order ${ctx.orderId}: no reservationId in saga context ` +
        `(this indicates the inventory step's success event never populated it - a bug upstream).`,
    );
  }
  return { orderId: ctx.orderId, reservationId: ctx.reservationId };
}
