import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { buildKafkaConfig, consumerGroupId, SaganovaKafkaOptions } from './kafka-config.factory';

export function kafkaMicroserviceOptions(
  options: SaganovaKafkaOptions,
  groupPurpose: string,
  topics: string[],
): MicroserviceOptions {
  return {
    transport: Transport.KAFKA,
    options: {
      client: buildKafkaConfig(options),
      consumer: { groupId: consumerGroupId(options.serviceName, groupPurpose) },
      subscribe: { topics, fromBeginning: false },
    },
  };
}
