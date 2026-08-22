import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

/**
 * Append-only. Never UPDATEd, never DELETEd - the (aggregateId, sequence)
 * unique constraint is what optimistic concurrency control rides on:
 * two concurrent commands computing the same next sequence number for
 * the same order will have one insert succeed and one fail with a
 * unique-violation, which the repository translates into ConcurrencyError.
 */
@Entity({ schema: 'order_service', name: 'event_store' })
@Unique('uq_order_event_store_aggregate_sequence', ['aggregateId', 'sequence'])
export class OrderEventStoreEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  @Index()
  aggregateId!: string;

  @Column()
  aggregateType!: string;

  @Column()
  sequence!: number;

  @Column()
  type!: string;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  occurredAt!: Date;

  @Column()
  correlationId!: string;
}
