import { KafkaConfig, logLevel } from 'kafkajs';

export interface SaganovaKafkaOptions {
  /** Logical service name, used as both the Kafka clientId and consumer group prefix. */
  serviceName: string;
  brokers: string[];
  ssl?: boolean;
  sasl?: 
    | { mechanism: 'plain'; username: string; password: string }
    | { mechanism: 'scram-sha-256'; username: string; password: string }
    | { mechanism: 'scram-sha-512'; username: string; password: string };
}

/**
 * Builds a production-safe KafkaJS config: bounded retries with backoff,
 * explicit connection timeouts, and structured logging instead of KafkaJS's
 * default console spam.
 */
export function buildKafkaConfig(opts: SaganovaKafkaOptions): KafkaConfig {
  return {
    clientId: opts.serviceName,
    brokers: opts.brokers,
    ssl: opts.ssl ?? false,
    sasl: opts.sasl,
    connectionTimeout: 5_000,
    requestTimeout: 30_000,
    retry: {
      initialRetryTime: 300,
      retries: 8,
      maxRetryTime: 30_000,
      factor: 0.2,
    },
    logLevel: logLevel.WARN,
  };
}

export function consumerGroupId(serviceName: string, purpose: string): string {
  return `${serviceName}.${purpose}`;
}

export function loadKafkaOptionsFromEnv(serviceName: string): SaganovaKafkaOptions {
  const brokers = (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(',');
  const sasl =
    process.env.KAFKA_SASL_USERNAME && process.env.KAFKA_SASL_PASSWORD
      ? {
          mechanism: (process.env.KAFKA_SASL_MECHANISM as 'plain') ?? 'plain',
          username: process.env.KAFKA_SASL_USERNAME,
          password: process.env.KAFKA_SASL_PASSWORD,
        }
      : undefined;

  return {
    serviceName,
    brokers,
    ssl: process.env.KAFKA_SSL === 'true',
    sasl,
  };
}
