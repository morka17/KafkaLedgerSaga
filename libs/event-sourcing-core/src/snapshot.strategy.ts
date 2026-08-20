import { StoredEvent } from './event-store.interface';

export interface Snapshot<TState> {
  aggregateId: string;
  version: number;
  state: TState;
  takenAt: Date;
}

export interface SnapshotStore<TState> {
  save(snapshot: Snapshot<TState>): Promise<void>;
  loadLatest(aggregateId: string): Promise<Snapshot<TState> | null>;
}

/**
 * Decides when an aggregate's full event history has grown long enough
 * that replaying it on every load would be wasteful (e.g. a Stock
 * aggregate with thousands of reserve/release events). Every N events,
 * the repository persists a snapshot; loads then replay only the tail.
 */
export class SnapshotStrategy {
  constructor(private readonly everyNEvents: number = 50) {}

  shouldSnapshot(currentVersion: number): boolean {
    return currentVersion > 0 && currentVersion % this.everyNEvents === 0;
  }

  /** Given a snapshot + events since it was taken, returns just the tail to replay. */
  tailToReplay<T>(allEvents: StoredEvent<T>[], snapshot: Snapshot<unknown> | null): StoredEvent<T>[] {
    if (!snapshot) return allEvents;
    return allEvents.filter((e) => e.sequence > snapshot.version);
  }
}
