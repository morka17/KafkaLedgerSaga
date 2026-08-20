import { Injectable, Module } from '@nestjs/common';
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

/**
 * Central metrics registry + the saga/domain-specific counters every
 * service cares about. Exposed on GET /metrics for Prometheus scraping
 * (wired in each service's health/metrics controller).
 */
@Injectable()
export class MetricsService {
  readonly registry = new Registry();

  readonly kafkaMessagesConsumed = new Counter({
    name: 'saganova_kafka_messages_consumed_total',
    help: 'Total Kafka messages consumed, by topic and outcome',
    labelNames: ['topic', 'outcome'] as const,
    registers: [this.registry],
  });

  readonly kafkaMessagesPublished = new Counter({
    name: 'saganova_kafka_messages_published_total',
    help: 'Total Kafka messages published, by topic',
    labelNames: ['topic'] as const,
    registers: [this.registry],
  });

  readonly sagaStepDuration = new Histogram({
    name: 'saganova_saga_step_duration_seconds',
    help: 'Time spent in each saga step, from command publish to terminal event',
    labelNames: ['saga', 'step', 'outcome'] as const,
    buckets: [0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
    registers: [this.registry],
  });

  readonly sagaCompensations = new Counter({
    name: 'saganova_saga_compensations_total',
    help: 'Total compensating transactions triggered, by saga and step',
    labelNames: ['saga', 'step'] as const,
    registers: [this.registry],
  });

  constructor() {
    collectDefaultMetrics({ register: this.registry });
  }
}

@Module({
  providers: [MetricsService],
  exports: [MetricsService],
})
export class PrometheusModule {}
