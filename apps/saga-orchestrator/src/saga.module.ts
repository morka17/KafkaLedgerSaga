import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KafkaModule, loadKafkaOptionsFromEnv } from '@saganova/kafka-client';
import { PostgresModule } from '@saganova/database';
import { PrometheusModule } from '@saganova/observability';

import { SagaInstanceEntity } from './orchestrator/saga-instance.entity';
import { SagaInstanceRepository } from './infrastructure/postgres/saga-instance.repository';
import { SagaStateMachine } from './orchestrator/saga-state-machine';
import { SagaCommandProducer } from './kafka/saga-command.producer';
import { SagaEventConsumer } from './kafka/saga-event.consumer';

import { SagasController } from './interfaces/http/sagas.controller';
import { HealthController } from './interfaces/http/health.controller';

@Module({
  imports: [
    PostgresModule.forService({ schema: 'saga_orchestrator', entities: [SagaInstanceEntity] }),
    TypeOrmModule.forFeature([SagaInstanceEntity]),
    KafkaModule.register(loadKafkaOptionsFromEnv('saga-orchestrator')),
    PrometheusModule,
  ],
  controllers: [SagasController, HealthController],
  providers: [SagaInstanceRepository, SagaCommandProducer, SagaStateMachine, SagaEventConsumer],
})
export class SagaModule {}
