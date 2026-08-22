import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get('live')
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('ready')
  ready(): { status: 'ok' } {
    // Readiness here is intentionally simple: if the HTTP server is
    // answering, TypeORM's connection (established at bootstrap) and the
    // Kafka consumer (started in OrderKafkaConsumer.onModuleInit) are
    // both already up, since Nest won't finish bootstrapping otherwise.
    return { status: 'ok' };
  }
}
