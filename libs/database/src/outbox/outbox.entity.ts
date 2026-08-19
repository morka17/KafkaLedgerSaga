import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Base outbox table columns. Each service extends this in its own
 * infrastructure/outbox/outbox.entity.ts with @Entity({ schema: '<service>' }).
 *
 * Row lifecycle:
 *   1. Written in the SAME DB transaction as the aggregate's event-store append.
 *   2. OutboxRelayService polls (`publishedAt IS NULL`) and publishes to Kafka.
 *   3. On successful publish, `publishedAt` is stamped - never deleted immediately,
 *      so it doubles as a publish audit log until a retention job prunes it.
 */
export abstract class OutboxRowBase {
  @PrimaryColumn('uuid')
  id!: string;

  @Column()
  @Index()
  aggregateId!: string;

  @Column()
  topic!: string;

  @Column()
  eventType!: string;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column()
  correlationId!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  @Index()
  publishedAt!: Date | null;

  @Column({ default: 0 })
  publishAttempts!: number;
}
