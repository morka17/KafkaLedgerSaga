import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitInventorySchema1700000000000 implements MigrationInterface {
  name = 'InitInventorySchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS inventory_service;`);

    await queryRunner.query(`
      CREATE TYPE inventory_service.reservation_status AS ENUM ('UNINITIALIZED', 'RESERVED', 'FAILED', 'RELEASED');
    `);

    await queryRunner.query(`
      CREATE TABLE inventory_service.event_store (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "aggregateId" TEXT NOT NULL,
        "aggregateType" TEXT NOT NULL,
        sequence INTEGER NOT NULL,
        type TEXT NOT NULL,
        payload JSONB NOT NULL,
        "occurredAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "correlationId" TEXT NOT NULL,
        CONSTRAINT uq_inventory_event_store_aggregate_sequence UNIQUE ("aggregateId", sequence)
      );
    `);
    await queryRunner.query(`CREATE INDEX idx_inventory_event_store_aggregate ON inventory_service.event_store ("aggregateId");`);

    await queryRunner.query(`
      CREATE TABLE inventory_service.reservation_projection (
        "orderId" UUID PRIMARY KEY,
        status inventory_service.reservation_status NOT NULL,
        "reservationId" UUID,
        lines JSONB NOT NULL,
        "failedSku" TEXT,
        "failReason" TEXT,
        version INTEGER NOT NULL,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    // Uses the SAME camelCase, quoted-identifier column naming as every
    // other table in this schema (TypeORM's default naming strategy) -
    // tools/scripts/seed-dev-data.ts targets this exact table/columns.
    await queryRunner.query(`
      CREATE TABLE inventory_service.stock_level (
        sku TEXT PRIMARY KEY,
        description TEXT NOT NULL,
        "qtyAvailable" INTEGER NOT NULL,
        "qtyReserved" INTEGER NOT NULL DEFAULT 0,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE inventory_service.outbox (
        id UUID PRIMARY KEY,
        "aggregateId" TEXT NOT NULL,
        topic TEXT NOT NULL,
        "eventType" TEXT NOT NULL,
        payload JSONB NOT NULL,
        "correlationId" TEXT NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "publishedAt" TIMESTAMPTZ,
        "publishAttempts" INTEGER NOT NULL DEFAULT 0
      );
    `);
    await queryRunner.query(`CREATE INDEX idx_inventory_outbox_aggregate ON inventory_service.outbox ("aggregateId");`);
    await queryRunner.query(`CREATE INDEX idx_inventory_outbox_unpublished ON inventory_service.outbox ("publishedAt") WHERE "publishedAt" IS NULL;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS inventory_service.outbox;`);
    await queryRunner.query(`DROP TABLE IF EXISTS inventory_service.stock_level;`);
    await queryRunner.query(`DROP TABLE IF EXISTS inventory_service.reservation_projection;`);
    await queryRunner.query(`DROP TABLE IF EXISTS inventory_service.event_store;`);
    await queryRunner.query(`DROP TYPE IF EXISTS inventory_service.reservation_status;`);
  }
}
