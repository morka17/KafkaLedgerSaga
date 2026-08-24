import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostgresModule } from '@saganova/database';
import { PrometheusModule } from '@saganova/observability';

import { AuditLogEntity } from './infrastructure/postgres/audit-log.entity';
import { AuditLogRepository } from './infrastructure/postgres/audit-log.repository';
import { AuditKafkaConsumer } from './kafka/audit-consumer.controller';

import { AuditController } from './interfaces/http/audit.controller';
import { HealthController } from './interfaces/http/health.controller';

@Module({
  imports: [
    PostgresModule.forService({ schema: 'audit_ledger', entities: [AuditLogEntity] }),
    TypeOrmModule.forFeature([AuditLogEntity]),
    // Note: no KafkaModule.register() here - this service only consumes
    // (via its own raw KafkaJS client in AuditKafkaConsumer), it never
    // publishes, so it has no need for KafkaProducerService.
    PrometheusModule,
  ],
  controllers: [AuditController, HealthController],
  providers: [AuditLogRepository, AuditKafkaConsumer],
})
export class AuditModule {}
