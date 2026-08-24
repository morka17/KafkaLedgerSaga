import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSagaOrchestratorSchema1700000000000 implements MigrationInterface {
  name = 'InitSagaOrchestratorSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS saga_orchestrator;`);

    await queryRunner.query(`
      CREATE TABLE saga_orchestrator.saga_instance (
        "sagaId" UUID PRIMARY KEY,
        "definitionName" TEXT NOT NULL,
        "currentStepIndex" INTEGER NOT NULL,
        status TEXT NOT NULL,
        context JSONB NOT NULL,
        history JSONB NOT NULL,
        "correlationId" TEXT NOT NULL,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX idx_saga_instance_status ON saga_orchestrator.saga_instance (status);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS saga_orchestrator.saga_instance;`);
  }
}
