import { Injectable } from '@nestjs/common';
import { ICommand, Saga } from '@nestjs/cqrs';
import { EMPTY, Observable } from 'rxjs';

/**
 * Local (in-process) Nest CQRS saga - reserved for same-process side
 * effects only. The actual checkout saga lives in apps/saga-orchestrator
 * and coordinates purely over Kafka. See order-service's order.saga.ts
 * for the identical rationale.
 */
@Injectable()
export class PaymentSaga {
  @Saga()
  onPaymentEvents = (_events$: Observable<unknown>): Observable<ICommand> => {
    return EMPTY;
  };
}
