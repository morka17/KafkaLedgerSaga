import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/** Tracks Kafka message ids so at-least-once delivery does not double-apply commands. */
@Entity('processed_messages')
export class ProcessedMessageRow {
  @PrimaryColumn()
  messageId!: string;

  @Column()
  messageType!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  processedAt!: Date;
}
