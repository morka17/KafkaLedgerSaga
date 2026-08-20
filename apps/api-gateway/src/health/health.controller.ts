import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';

/**
 * Liveness/readiness for the k8s deployment's probes
 * (see infra/k8s/base/api-gateway/deployment.yaml).
 *
 * - /health/live: process is up and the event loop isn't wedged.
 *   Kubernetes restarts the pod if this fails.
 * - /health/ready: the gateway can actually do useful work (Kafka
 *   producer is connected). Kubernetes stops routing traffic here if
 *   this fails, without restarting the pod - lets Kafka reconnect
 *   without a crash loop.
 */
@Controller('health')
export class HealthController {
  private static kafkaReady = false;

  static markKafkaReady(ready: boolean): void {
    HealthController.kafkaReady = ready;
  }

  @Get('live')
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('ready')
  ready(): { status: 'ok'; kafka: string } {
    if (!HealthController.kafkaReady) {
      throw new ServiceUnavailableException('Kafka producer not connected');
    }
    return { status: 'ok', kafka: 'connected' };
  }
}
