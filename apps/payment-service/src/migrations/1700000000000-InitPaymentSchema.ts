import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitPaymentSchema1700000000000 implements MigrationInterface {
  name = 'InitPaymentSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS payment_service;`);

    await queryRunner.query(`
      CREATE TYPE payment_service.payment_status AS ENUM ('UNINITIALIZED', 'AUTHORIZED', 'DECLINED', 'REFUNDED');
    `);

    await queryRunner.query(`
      CREATE TABLE payment_service.event_store (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "aggregateId" TEXT NOT NULL,
        "aggregateType" TEXT NOT NULL,
        sequence INTEGER NOT NULL,
        type TEXT NOT NULL,
        payload JSONB NOT NULL,
        "occurredAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "correlationId" TEXT NOT NULL,
        CONSTRAINT uq_payment_event_store_aggregate_sequence UNIQUE ("aggregateId", sequence)
      );
    `);
    await queryRunner.query(`CREATE INDEX idx_payment_event_store_aggregate ON payment_service.event_store ("aggregateId");`);

    await queryRunner.query(`
      CREATE TABLE payment_service.payment_projection (
        "paymentId" UUID PRIMARY KEY,
        "orderId" UUID NOT NULL,
        status payment_service.payment_status NOT NULL,
        "amountCents" INTEGER NOT NULL,
        "pspReference" TEXT,
        "declineCode" TEXT,
        reason TEXT,
        version INTEGER NOT NULL,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    // An order can only ever have one payment attempt recorded in this
    // simplified model, which is exactly the invariant AuthorizePaymentHandler's
    // idempotency check relies on.
    await queryRunner.query(`CREATE UNIQUE INDEX idx_payment_projection_order ON payment_service.payment_projection ("orderId");`);

    await queryRunner.query(`
      CREATE TABLE payment_service.outbox (
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
    await queryRunner.query(`CREATE INDEX idx_payment_outbox_aggregate ON payment_service.outbox ("aggregateId");`);
    await queryRunner.query(`CREATE INDEX idx_payment_outbox_unpublished ON payment_service.outbox ("publishedAt") WHERE "publishedAt" IS NULL;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS payment_service.outbox;`);
    await queryRunner.query(`DROP TABLE IF EXISTS payment_service.payment_projection;`);
    await queryRunner.query(`DROP TABLE IF EXISTS payment_service.event_store;`);
    await queryRunner.query(`DROP TYPE IF EXISTS payment_service.payment_status;`);
  }
}
