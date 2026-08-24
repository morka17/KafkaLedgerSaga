import { AggregateRoot } from '@saganova/event-sourcing-core';
import {
  InventoryEventType,
  InventoryReservedPayload,
  InventoryReservationFailedPayload,
  InventoryReleasedPayload,
  ReservationLine,
} from '@saganova/event-contracts';
import { ReservationStatus } from './reservation-state';

/**
 * IMPORTANT - what this aggregate is and isn't:
 *
 * This aggregate's identity is the ORDER (aggregateId = orderId), and it
 * records the OUTCOME of one reservation attempt as an auditable fact
 * (RESERVED, FAILED, or later RELEASED). It is deliberately NOT where the
 * no-oversell invariant is enforced.
 *
 * That invariant - "the sum of every order's reserved qty for a SKU never
 * exceeds what's on hand" - is a per-SKU concern shared across every
 * concurrent order, and re-deriving "current available stock" by
 * replaying this aggregate's entire event history on every reservation
 * attempt would not scale. Instead, the actual stock math happens via
 * row-level locking (SELECT ... FOR UPDATE) on a plain counter table -
 * see infrastructure/postgres/stock-level.entity.ts and stock.repository.ts.
 *
 * ReserveStockHandler runs both inside ONE database transaction: lock and
 * decrement the counter rows first (this is what can fail with
 * InsufficientStockError, aborting the whole transaction), and only once
 * that succeeds does it apply RESERVED here to produce the audit event
 * and the outbox row the saga orchestrator is waiting on.
 */
export interface StockAggregateState {
  status: ReservationStatus;
  orderId: string;
  reservationId?: string;
  lines: ReservationLine[];
  failedSku?: string;
  failReason?: string;
}

const BLANK_STATE: StockAggregateState = {
  status: ReservationStatus.UNINITIALIZED,
  orderId: '',
  lines: [],
};

export class ReservationAlreadyFinalizedError extends Error {
  constructor(orderId: string, currentStatus: ReservationStatus) {
    super(`Reservation for order ${orderId} is already ${currentStatus} - refusing to transition again.`);
    this.name = 'ReservationAlreadyFinalizedError';
  }
}

export class InsufficientStockError extends Error {
  constructor(
    public readonly sku: string,
    reason: string,
  ) {
    super(reason);
    this.name = 'InsufficientStockError';
  }
}

export class StockAggregate extends AggregateRoot<StockAggregateState> {
  private constructor(id: string, state: StockAggregateState) {
    super(id, state);
  }

  static reserved(orderId: string, reservationId: string, lines: ReservationLine[]): StockAggregate {
    const aggregate = new StockAggregate(orderId, { ...BLANK_STATE });
    const payload: InventoryReservedPayload = { reservationId, orderId, lines };
    aggregate.apply(InventoryEventType.INVENTORY_RESERVED, payload);
    return aggregate;
  }

  static failed(orderId: string, sku: string, reason: string): StockAggregate {
    const aggregate = new StockAggregate(orderId, { ...BLANK_STATE });
    const payload: InventoryReservationFailedPayload = { orderId, sku, reason };
    aggregate.apply(InventoryEventType.INVENTORY_RESERVATION_FAILED, payload);
    return aggregate;
  }

  static blank(orderId: string): StockAggregate {
    return new StockAggregate(orderId, { ...BLANK_STATE });
  }

  /** Compensating transaction - undoes a prior RESERVED when a later saga step (payment) fails. */
  release(): void {
    if (this.state.status !== ReservationStatus.RESERVED) {
      throw new ReservationAlreadyFinalizedError(this.aggregateId, this.state.status);
    }
    const payload: InventoryReleasedPayload = {
      reservationId: this.state.reservationId as string,
      orderId: this.aggregateId,
    };
    this.apply(InventoryEventType.INVENTORY_RELEASED, payload);
  }

  get status(): ReservationStatus {
    return this.state.status;
  }

  get snapshot(): Readonly<StockAggregateState> {
    return this.state;
  }

  protected when(eventType: string, payload: unknown): void {
    switch (eventType) {
      case InventoryEventType.INVENTORY_RESERVED: {
        const p = payload as InventoryReservedPayload;
        this.state = {
          status: ReservationStatus.RESERVED,
          orderId: p.orderId,
          reservationId: p.reservationId,
          lines: p.lines,
        };
        return;
      }
      case InventoryEventType.INVENTORY_RESERVATION_FAILED: {
        const p = payload as InventoryReservationFailedPayload;
        this.state = {
          ...this.state,
          status: ReservationStatus.FAILED,
          orderId: p.orderId,
          failedSku: p.sku,
          failReason: p.reason,
        };
        return;
      }
      case InventoryEventType.INVENTORY_RELEASED: {
        this.state = { ...this.state, status: ReservationStatus.RELEASED };
        return;
      }
      default:
        throw new Error(`StockAggregate cannot apply unknown event type "${eventType}"`);
    }
  }
}
