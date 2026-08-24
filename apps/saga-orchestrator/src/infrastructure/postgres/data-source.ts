import 'dotenv/config';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { SagaInstanceEntity } from '../../orchestrator/saga-instance.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME ?? 'saganova',
  password: process.env.DB_PASSWORD ?? 'saganova',
  database: process.env.DB_NAME ?? 'saganova',
  schema: 'saga_orchestrator',
  entities: [SagaInstanceEntity],
  migrations: [__dirname + '/../../migrations/*.ts'],
  synchronize: false,
});

export default AppDataSource;
