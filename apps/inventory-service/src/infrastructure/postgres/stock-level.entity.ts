import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * The hot-path invariant enforcement lives here, not in the event-sourced
 * StockAggregate: "available to sell" = qtyAvailable - qtyReserved, and
 * that arithmetic must be checked and updated under a row lock so two
 * concurrent orders for the same SKU can never both succeed past the
 * available quantity. See StockRepository.reserveLinesWithinTransaction.
 */
@Entity({ schema: 'inventory_service', name: 'stock_level' })
export class StockLevelEntity {
  @PrimaryColumn()
  sku!: string;

  @Column()
  description!: string;

  /** Total units this warehouse owns, regardless of reservation state. */
  @Column()
  qtyAvailable!: number;

  /** Units currently held by in-flight (not yet confirmed or released) orders. */
  @Column({ default: 0 })
  qtyReserved!: number;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
