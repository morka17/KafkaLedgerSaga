import { DynamicModule, Module, Provider } from '@nestjs/common';
import { KafkaProducerService } from './kafka-producer.service';
import { SaganovaKafkaOptions } from './kafka-config.factory';

export const KAFKA_OPTIONS = Symbol('KAFKA_OPTIONS');

/**
 * Dynamic module every service imports once in its root AppModule:
 *
 *   KafkaModule.register(loadKafkaOptionsFromEnv('order-service'))
 *
 * Exposes a ready-to-inject KafkaProducerService. Consumers are registered
 * separately per-service via @nestjs/microservices' ClientsModule /
 * @EventPattern controllers, since each service listens to a different
 * set of topics.
 */
@Module({})
export class KafkaModule {
  static register(options: SaganovaKafkaOptions): DynamicModule {
    const optionsProvider: Provider = {
      provide: KAFKA_OPTIONS,
      useValue: options,
    };

    const producerProvider: Provider = {
      provide: KafkaProducerService,
      useFactory: () => new KafkaProducerService(options),
    };

    return {
      module: KafkaModule,
      providers: [optionsProvider, producerProvider],
      exports: [KafkaProducerService, optionsProvider],
      global: true,
    };
  }
}
