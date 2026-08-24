import 'dotenv/config';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { AuditLogEntity } from './audit-log.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME ?? 'saganova',
  password: process.env.DB_PASSWORD ?? 'saganova',
  database: process.env.DB_NAME ?? 'saganova',
  schema: 'audit_ledger',
  entities: [AuditLogEntity],
  migrations: [__dirname + '/../../migrations/*.ts'],
  synchronize: false,
});

export default AppDataSource;
