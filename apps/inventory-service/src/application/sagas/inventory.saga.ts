import { Injectable } from '@nestjs/common';
import { ICommand, Saga } from '@nestjs/cqrs';
import { EMPTY, Observable } from 'rxjs';

/** Local-only extension point, same rationale as order-service's order.saga.ts. */
@Injectable()
export class InventorySaga {
  @Saga()
  onInventoryEvents = (_events$: Observable<unknown>): Observable<ICommand> => {
    return EMPTY;
  };
}
