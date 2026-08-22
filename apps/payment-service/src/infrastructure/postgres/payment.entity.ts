import { Column, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { PaymentStatus } from '../../domain/payment-state';

@Entity({ schema: 'payment_service', name: 'payment_projection' })
export class PaymentProjectionEntity {
  @PrimaryColumn('uuid')
  paymentId!: string;

  @Column('uuid')
  @Index()
  orderId!: string;

  @Column({ type: 'enum', enum: PaymentStatus })
  status!: PaymentStatus;

  @Column()
  amountCents!: number;

  @Column({ nullable: true })
  pspReference?: string;

  @Column({ nullable: true })
  declineCode?: string;

  @Column({ nullable: true })
  reason?: string;

  @Column()
  version!: number;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
