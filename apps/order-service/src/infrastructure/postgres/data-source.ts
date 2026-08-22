import 'dotenv/config';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { OrderEventStoreEntity } from '../event-store/event-store.entity';
import { OrderProjectionEntity } from './order.entity';
import { OrderOutboxEntity } from '../outbox/outbox.entity';

/**
 * Standalone DataSource for the TypeORM CLI (migration:run / migration:generate).
 * Deliberately NOT the same instance the running app uses (that's built by
 * PostgresModule.forService inside Nest's DI container) - the CLI runs
 * outside of Nest entirely, so it needs its own plain construction.
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME ?? 'saganova',
  password: process.env.DB_PASSWORD ?? 'saganova',
  database: process.env.DB_NAME ?? 'saganova',
  schema: 'order_service',
  entities: [OrderEventStoreEntity, OrderProjectionEntity, OrderOutboxEntity],
  migrations: [__dirname + '/../../migrations/*.ts'],
  synchronize: false,
});

export default AppDataSource;
