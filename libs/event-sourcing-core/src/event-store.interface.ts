export interface StoredEvent<T = unknown> {
    aggregateId: string;
    aggregateType: string;
    sequence: number;
    type: string;
    payload: T;
    occurredAt: Date;
    correlationId: string;
  }
  
  /**
   * Contract every service's Postgres-backed event store implements.
   * `append` MUST be optimistic-concurrency-checked on `expectedVersion`
   * so two concurrent commands on the same aggregate can't silently
   * overwrite each other's history.
   */
  export interface EventStore {
    append(
      aggregateId: string,
      aggregateType: string,
      events: Omit<StoredEvent, 'aggregateId' | 'aggregateType' | 'sequence'>[],
      expectedVersion: number,
    ): Promise<void>;
  
    /** Loads the full (or post-snapshot) event history for replay. */
    loadStream(aggregateId: string, fromSequence?: number): Promise<StoredEvent[]>;
  }
  
  export class ConcurrencyError extends Error {
    constructor(aggregateId: string, expectedVersion: number) {
      super(
        `Concurrency conflict on aggregate ${aggregateId}: expected version ${expectedVersion} is stale. ` +
          `Reload the aggregate and retry the command.`,
      );
      this.name = 'ConcurrencyError';
    }
  }
  