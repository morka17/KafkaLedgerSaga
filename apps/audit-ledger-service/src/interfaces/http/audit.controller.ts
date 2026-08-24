import { Controller, Get, Param } from '@nestjs/common';
import { AuditLogRepository } from '../../infrastructure/postgres/audit-log.repository';

/** Internal-only debugging surface: "show me everything that happened for this checkout." */
@Controller('internal/audit')
export class AuditController {
  constructor(private readonly auditLogRepository: AuditLogRepository) {}

  @Get('by-correlation/:correlationId')
  async byCorrelation(@Param('correlationId') correlationId: string) {
    return this.auditLogRepository.findByCorrelationId(correlationId);
  }

  @Get('by-aggregate/:aggregateId')
  async byAggregate(@Param('aggregateId') aggregateId: string) {
    return this.auditLogRepository.findByAggregateId(aggregateId);
  }
}
