import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitOrderSchema1700000000000 implements MigrationInterface {
  name = 'InitOrderSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS order_service;`);

    await queryRunner.query(`
      CREATE TYPE order_service.order_status AS ENUM ('UNINITIALIZED', 'CREATED', 'CONFIRMED', 'CANCELLED');
    `);

    await queryRunner.query(`
      CREATE TABLE order_service.event_store (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "aggregateId" TEXT NOT NULL,
        "aggregateType" TEXT NOT NULL,
        sequence INTEGER NOT NULL,
        type TEXT NOT NULL,
        payload JSONB NOT NULL,
        "occurredAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "correlationId" TEXT NOT NULL,
        CONSTRAINT uq_order_event_store_aggregate_sequence UNIQUE ("aggregateId", sequence)
      );
    `);
    await queryRunner.query(`CREATE INDEX idx_order_event_store_aggregate ON order_service.event_store ("aggregateId");`);

    await queryRunner.query(`
      CREATE TABLE order_service.order_projection (
        "orderId" UUID PRIMARY KEY,
        "customerId" UUID NOT NULL,
        status order_service.order_status NOT NULL,
        items JSONB NOT NULL,
        "totalCents" INTEGER NOT NULL,
        "paymentId" UUID,
        "cancelReason" TEXT,
        version INTEGER NOT NULL,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX idx_order_projection_customer ON order_service.order_projection ("customerId");`);

    await queryRunner.query(`
      CREATE TABLE order_service.outbox (
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
    await queryRunner.query(`CREATE INDEX idx_order_outbox_aggregate ON order_service.outbox ("aggregateId");`);
    await queryRunner.query(`CREATE INDEX idx_order_outbox_unpublished ON order_service.outbox ("publishedAt") WHERE "publishedAt" IS NULL;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS order_service.outbox;`);
    await queryRunner.query(`DROP TABLE IF EXISTS order_service.order_projection;`);
    await queryRunner.query(`DROP TABLE IF EXISTS order_service.event_store;`);
    await queryRunner.query(`DROP TYPE IF EXISTS order_service.order_status;`);
  }
}
