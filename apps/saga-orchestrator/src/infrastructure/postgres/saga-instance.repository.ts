import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SagaInstanceSnapshot } from '@saganova/saga-toolkit';
import { SagaInstanceEntity } from '../../orchestrator/saga-instance.entity';

@Injectable()
export class SagaInstanceRepository {
  constructor(
    @InjectRepository(SagaInstanceEntity)
    private readonly repo: Repository<SagaInstanceEntity>,
  ) {}

  async findById(sagaId: string): Promise<SagaInstanceEntity | null> {
    return this.repo.findOne({ where: { sagaId } });
  }

  async save<TContext extends Record<string, unknown>>(
    snapshot: SagaInstanceSnapshot<TContext>,
    correlationId: string,
  ): Promise<void> {
    await this.repo.upsert(
      {
        sagaId: snapshot.sagaId,
        definitionName: snapshot.definitionName,
        currentStepIndex: snapshot.currentStepIndex,
        status: snapshot.status,
        context: snapshot.context as unknown as object,
        history: snapshot.history,
        correlationId,
      },
      ['sagaId'],
    );
  }

  toSnapshot<TContext extends Record<string, unknown> = Record<string, unknown>>(
    entity: SagaInstanceEntity,
  ): SagaInstanceSnapshot<TContext> {
    return {
      sagaId: entity.sagaId,
      definitionName: entity.definitionName,
      currentStepIndex: entity.currentStepIndex,
      status: entity.status,
      context: entity.context as unknown as TContext,
      history: entity.history,
    };
  }
}
