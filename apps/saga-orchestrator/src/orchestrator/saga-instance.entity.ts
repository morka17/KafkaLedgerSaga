import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { SagaStatus } from '@saganova/saga-toolkit';

/**
 * Persisted state for one in-flight (or completed) checkout saga, keyed
 * by orderId. This is what lets the orchestrator survive a restart
 * mid-transaction: on the next relevant event, it reloads this row
 * instead of trying to reconstruct saga progress from Kafka alone.
 */
@Entity({ schema: 'saga_orchestrator', name: 'saga_instance' })
export class SagaInstanceEntity {
  @PrimaryColumn('uuid')
  sagaId!: string; // == orderId

  @Column()
  definitionName!: string;

  @Column()
  currentStepIndex!: number;

  @Column({ type: 'text' })
  status!: SagaStatus;

  @Column({ type: 'jsonb' })
  context!: Record<string, unknown>;

  @Column({ type: 'jsonb' })
  history!: { step: string; event: string; at: string }[];

  @Column()
  correlationId!: string;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
