import { StoredEvent } from './event-store.interface';

/**
 * Base class for every domain aggregate (Order, Payment, Stock, ...).
 *
 * Pattern: commands call a `doX()` method which validates invariants and
 * calls `apply()` with a new domain event. `apply()` both mutates local
 * state (via the `when()` reducer) AND queues the event to be persisted.
 * The aggregate never mutates its own fields directly outside of `when()` -
 * that's what keeps replay and live application byte-for-byte identical.
 */
export abstract class AggregateRoot<TState> {
  private _version = 0;
  private _uncommittedEvents: { type: string; payload: unknown; occurredAt: Date }[] = [];

  protected constructor(
    protected readonly id: string,
    protected state: TState,
  ) {}

  get aggregateId(): string {
    return this.id;
  }

  /** Version = number of events applied so far. Used for optimistic concurrency on append. */
  get version(): number {
    return this._version;
  }

  get uncommittedEvents() {
    return [...this._uncommittedEvents];
  }

  /** Subclasses implement this switch/reducer to fold an event into state. */
  protected abstract when(eventType: string, payload: unknown): void;

  /** Call from command handlers after validating invariants. */
  protected apply(eventType: string, payload: unknown): void {
    this.when(eventType, payload);
    this._version += 1;
    this._uncommittedEvents.push({ type: eventType, payload, occurredAt: new Date() });
  }

  /** Used by the repository to rebuild an aggregate from its event stream (or a snapshot + tail). */
  static hydrate<TState, A extends AggregateRoot<TState>>(
    instance: A,
    history: StoredEvent[],
  ): A {
    for (const evt of history) {
      instance.when(evt.type, evt.payload);
      instance._version = evt.sequence;
    }
    return instance;
  }

  /** Called by the repository after successfully persisting `uncommittedEvents`. */
  markEventsAsCommitted(): void {
    this._uncommittedEvents = [];
  }
}
