import 'dotenv/config';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { InventoryEventStoreEntity } from '../event-store/event-store.entity';
import { ReservationProjectionEntity } from './reservation.entity';
import { StockLevelEntity } from './stock-level.entity';
import { InventoryOutboxEntity } from '../outbox/outbox.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME ?? 'saganova',
  password: process.env.DB_PASSWORD ?? 'saganova',
  database: process.env.DB_NAME ?? 'saganova',
  schema: 'inventory_service',
  entities: [InventoryEventStoreEntity, ReservationProjectionEntity, StockLevelEntity, InventoryOutboxEntity],
  migrations: [__dirname + '/../../migrations/*.ts'],
  synchronize: false,
});

export default AppDataSource;
