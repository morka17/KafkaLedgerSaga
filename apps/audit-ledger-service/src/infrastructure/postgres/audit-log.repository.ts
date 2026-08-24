import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { AuditLogEntity } from './audit-log.entity';

const POSTGRES_UNIQUE_VIOLATION = '23505';

export interface AuditRecordInput {
  topic: string;
  partition: number;
  offset: string;
  eventType: string;
  aggregateId?: string;
  correlationId: string;
  payload: object;
}

@Injectable()
export class AuditLogRepository {
  private readonly logger = new Logger(AuditLogRepository.name);

  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly repo: Repository<AuditLogEntity>,
  ) {}

  /** Idempotent insert - a redelivered (topic, partition, offset) silently no-ops instead of erroring. */
  async record(input: AuditRecordInput): Promise<void> {
    try {
      await this.repo.insert({
        topic: input.topic,
        partition: input.partition,
        offset: input.offset,
        eventType: input.eventType,
        aggregateId: input.aggregateId,
        correlationId: input.correlationId,
        payload: input.payload,
      });
    } catch (err) {
      if (this.isUniqueViolation(err)) {
        this.logger.debug(`Audit record for ${input.topic}[${input.partition}]@${input.offset} already exists - skipping.`);
        return;
      }
      throw err;
    }
  }

  async findByCorrelationId(correlationId: string): Promise<AuditLogEntity[]> {
    return this.repo.find({ where: { correlationId }, order: { consumedAt: 'ASC' } });
  }

  async findByAggregateId(aggregateId: string): Promise<AuditLogEntity[]> {
    return this.repo.find({ where: { aggregateId }, order: { consumedAt: 'ASC' } });
  }

  private isUniqueViolation(err: unknown): boolean {
    return (
      err instanceof QueryFailedError &&
      (err as unknown as { code?: string }).code === POSTGRES_UNIQUE_VIOLATION
    );
  }
}
