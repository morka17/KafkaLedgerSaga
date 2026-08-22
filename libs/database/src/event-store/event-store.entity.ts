import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/** Append-only event stream row — one row per domain event per aggregate. */
@Entity('event_store')
@Index(['aggregateId', 'sequence'], { unique: true })
export class EventStoreRow {
  @PrimaryColumn('uuid')
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

  @Column()
  correlationId!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  occurredAt!: Date;
}
