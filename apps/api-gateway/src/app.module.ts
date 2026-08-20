import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { KafkaModule, loadKafkaOptionsFromEnv } from '@saganova/kafka-client';
import { CorrelationIdInterceptor, LoggingInterceptor } from '@saganova/common';
import { AuthModule } from './auth/auth.module';
import { OrdersModule } from './orders/orders.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    KafkaModule.register(loadKafkaOptionsFromEnv('api-gateway')),
    AuthModule,
    OrdersModule,
    HealthModule,
  ],
  providers: [
    // Order matters: correlation id must be assigned before anything logs.
    { provide: APP_INTERCEPTOR, useClass: CorrelationIdInterceptor },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
