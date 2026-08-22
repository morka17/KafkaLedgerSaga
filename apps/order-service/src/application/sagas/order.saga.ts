import { Injectable } from '@nestjs/common';
import { ICommand, Saga } from '@nestjs/cqrs';
import { Observable, EMPTY } from 'rxjs';

/**
 * This is Nest CQRS's LOCAL saga mechanism - an in-process EventBus
 * listener - and is deliberately NOT where cross-service orchestration
 * lives. The actual order-fulfillment saga (reserve inventory -> charge
 * payment -> confirm/cancel) is owned by apps/saga-orchestrator, which
 * coordinates purely through Kafka so it survives this service
 * restarting mid-transaction.
 *
 * This local saga is reserved for same-process side effects that don't
 * need to survive a crash and don't need to be visible to other
 * services - e.g. emitting an internal metric the moment an order is
 * created. It currently has no active reactions; it's wired in as the
 * extension point for exactly that class of concern. To react to a
 * local event, inject EventBus, publish a typed event from the command
 * handler after a successful save, and filter for it here with ofType().
 */
@Injectable()
export class OrderSaga {
  @Saga()
  onOrderEvents = (_events$: Observable<unknown>): Observable<ICommand> => {
    return EMPTY;
  };
}
