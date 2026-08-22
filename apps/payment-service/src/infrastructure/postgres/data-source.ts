import 'dotenv/config';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { PaymentEventStoreEntity } from '../event-store/event-store.entity';
import { PaymentProjectionEntity } from './payment.entity';
import { PaymentOutboxEntity } from '../outbox/outbox.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME ?? 'saganova',
  password: process.env.DB_PASSWORD ?? 'saganova',
  database: process.env.DB_NAME ?? 'saganova',
  schema: 'payment_service',
  entities: [PaymentEventStoreEntity, PaymentProjectionEntity, PaymentOutboxEntity],
  migrations: [__dirname + '/../../migrations/*.ts'],
  synchronize: false,
});

export default AppDataSource;
