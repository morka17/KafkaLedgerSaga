import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitAuditLedgerSchema1700000000000 implements MigrationInterface {
  name = 'InitAuditLedgerSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS audit_ledger;`);

    await queryRunner.query(`
      CREATE TABLE audit_ledger.audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        topic TEXT NOT NULL,
        partition INTEGER NOT NULL,
        "offset" TEXT NOT NULL,
        "eventType" TEXT NOT NULL,
        "aggregateId" TEXT,
        "correlationId" TEXT NOT NULL,
        payload JSONB NOT NULL,
        "consumedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT uq_audit_log_topic_partition_offset UNIQUE (topic, partition, "offset")
      );
    `);
    await queryRunner.query(`CREATE INDEX idx_audit_log_topic ON audit_ledger.audit_log (topic);`);
    await queryRunner.query(`CREATE INDEX idx_audit_log_event_type ON audit_ledger.audit_log ("eventType");`);
    await queryRunner.query(`CREATE INDEX idx_audit_log_aggregate_id ON audit_ledger.audit_log ("aggregateId");`);
    await queryRunner.query(`CREATE INDEX idx_audit_log_correlation_id ON audit_ledger.audit_log ("correlationId");`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS audit_ledger.audit_log;`);
  }
}
