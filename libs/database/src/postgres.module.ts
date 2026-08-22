import { DynamicModule, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

export interface PostgresModuleOptions {
  /** Each service connects to its OWN schema/database - never a shared one. */
  schema: string;
  entities: unknown[];
  /** Set DB_SYNC=true locally to auto-create tables; never enable in production. */
  synchronize?: boolean;
}

/**
 * Standard Postgres connection every service registers in its AppModule:
 *
 *   PostgresModule.forService({ schema: 'order_service', entities: [...] })
 *
 * Reads connection details from env so the same code runs unmodified in
 * docker-compose, k8s, and CI.
 */
@Module({})
export class PostgresModule {
  static forService(options: PostgresModuleOptions): DynamicModule {
    return {
      module: PostgresModule,
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_HOST ?? 'localhost',
          port: Number(process.env.DB_PORT ?? 5432),
          username: process.env.DB_USERNAME ?? 'saganova',
          password: process.env.DB_PASSWORD ?? 'saganova',
          database: process.env.DB_NAME ?? 'saganova',
          schema: options.schema,
          entities: options.entities as never[],
          synchronize: options.synchronize ?? false,
          logging: process.env.DB_LOGGING === 'true',
          maxQueryExecutionTime: 200, // logs slow queries
          extra: {
            max: Number(process.env.DB_POOL_SIZE ?? 10),
          },
        }),
      ],
      exports: [TypeOrmModule],
    };
  }
}
