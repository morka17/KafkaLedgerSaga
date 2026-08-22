import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { OrderStatus } from '../../domain/order-state';

/**
 * Read-model / query projection - NOT the source of truth (event_store
 * is). Updated inside the same transaction as the event append, so it's
 * always consistent with the event stream; kept separate so queries
 * never have to replay events.
 */
@Entity({ schema: 'order_service', name: 'order_projection' })
export class OrderProjectionEntity {
  @PrimaryColumn('uuid')
  orderId!: string;

  @Column()
  customerId!: string;

  @Column({ type: 'enum', enum: OrderStatus })
  status!: OrderStatus;

  @Column({ type: 'jsonb' })
  items!: unknown;

  @Column()
  totalCents!: number;

  @Column({ nullable: true })
  paymentId?: string;

  @Column({ nullable: true })
  cancelReason?: string;

  @Column()
  version!: number;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
