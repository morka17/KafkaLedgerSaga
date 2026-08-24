import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity({ schema: 'inventory_service', name: 'event_store' })
@Unique('uq_inventory_event_store_aggregate_sequence', ['aggregateId', 'sequence'])
export class InventoryEventStoreEntity {
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
