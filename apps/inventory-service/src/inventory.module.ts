import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KafkaModule, loadKafkaOptionsFromEnv } from '@saganova/kafka-client';
import { PostgresModule } from '@saganova/database';
import { PrometheusModule } from '@saganova/observability';

import { InventoryEventStoreEntity } from './infrastructure/event-store/event-store.entity';
import { ReservationProjectionEntity } from './infrastructure/postgres/reservation.entity';
import { StockLevelEntity } from './infrastructure/postgres/stock-level.entity';
import { InventoryOutboxEntity } from './infrastructure/outbox/outbox.entity';

import { InventoryEventStoreRepository } from './infrastructure/event-store/event-store.repository';
import { ReservationProjectionRepository } from './infrastructure/postgres/reservation.repository';
import { StockRepository } from './infrastructure/postgres/stock.repository';
import { InventoryOutboxRepository } from './infrastructure/outbox/outbox.repository';
import { InventoryOutboxRelayService } from './infrastructure/outbox/outbox-relay.service';
import { InventoryKafkaConsumer } from './infrastructure/kafka/inventory-consumer.controller';
import { InventoryKafkaProducer } from './infrastructure/kafka/inventory-producer.service';

import { ReserveStockHandler } from './application/commands/handlers/reserve-stock.handler';
import { ReleaseInventoryHandler } from './application/commands/handlers/release-inventory.handler';
import { InventorySaga } from './application/sagas/inventory.saga';

import { HealthController } from './interfaces/http/health.controller';

const COMMAND_HANDLERS = [ReserveStockHandler, ReleaseInventoryHandler];

@Module({
  imports: [
    CqrsModule,
    PostgresModule.forService({
      schema: 'inventory_service',
      entities: [InventoryEventStoreEntity, ReservationProjectionEntity, StockLevelEntity, InventoryOutboxEntity],
    }),
    TypeOrmModule.forFeature([InventoryEventStoreEntity, ReservationProjectionEntity, StockLevelEntity, InventoryOutboxEntity]),
    KafkaModule.register(loadKafkaOptionsFromEnv('inventory-service')),
    PrometheusModule,
  ],
  controllers: [HealthController],
  providers: [
    InventoryEventStoreRepository,
    ReservationProjectionRepository,
    StockRepository,
    InventoryOutboxRepository,
    InventoryOutboxRelayService,
    InventoryKafkaConsumer,
    InventoryKafkaProducer,
    InventorySaga,
    ...COMMAND_HANDLERS,
  ],
})
export class InventoryModule {}
