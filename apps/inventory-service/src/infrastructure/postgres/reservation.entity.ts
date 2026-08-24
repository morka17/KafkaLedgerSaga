import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { ReservationStatus } from '../../domain/reservation-state';

/** Read-model projection of StockAggregate, keyed by orderId. */
@Entity({ schema: 'inventory_service', name: 'reservation_projection' })
export class ReservationProjectionEntity {
  @PrimaryColumn('uuid')
  orderId!: string;

  @Column({ type: 'enum', enum: ReservationStatus })
  status!: ReservationStatus;

  @Column({ nullable: true })
  reservationId?: string;

  @Column({ type: 'jsonb' })
  lines!: unknown;

  @Column({ nullable: true })
  failedSku?: string;

  @Column({ nullable: true })
  failReason?: string;

  @Column()
  version!: number;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
