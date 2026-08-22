import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { OrderLineItem } from '@saganova/event-contracts';
import { OrderState } from '../../domain/order-state';

@Entity('orders')
export class OrderEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid')
  customerId!: string;

  @Column({ type: 'varchar', length: 32 })
  status!: OrderState;

  @Column({ type: 'int' })
  totalCents!: number;

  @Column({ type: 'jsonb' })
  items!: OrderLineItem[];

  @Column({ type: 'uuid', nullable: true })
  paymentId!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reason!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
