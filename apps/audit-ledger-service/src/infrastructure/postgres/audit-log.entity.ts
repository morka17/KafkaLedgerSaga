import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

/**
 * Append-only, immutable audit trail of every message this service has
 * ever seen on any subscribed topic. Never updated, never deleted (a
 * retention/archival job is the only thing that should ever remove rows,
 * and even then to cold storage, not to nowhere).
 *
 * The unique constraint on (topic, partition, "offset") is the
 * idempotency guard: Kafka's at-least-once delivery means the same
 * message can arrive twice, and this ensures a redelivered message
 * produces zero rows the second time, not a duplicate audit entry.
 */
@Entity({ schema: 'audit_ledger', name: 'audit_log' })
@Unique('uq_audit_log_topic_partition_offset', ['topic', 'partition', 'offset'])
export class AuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  @Index()
  topic!: string;

  @Column()
  partition!: number;

  @Column()
  offset!: string; // Kafka offsets can exceed JS safe-integer range - stored as text

  @Column()
  @Index()
  eventType!: string;

  @Column({ nullable: true })
  @Index()
  aggregateId?: string;

  @Column()
  @Index()
  correlationId!: string;

  @Column({ type: 'jsonb' })
  payload!: object;

  @CreateDateColumn({ type: 'timestamptz' })
  consumedAt!: Date;
}
