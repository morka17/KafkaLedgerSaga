/**
 * Reports applied vs. pending TypeORM migrations across every service
 * schema in one table - useful before a deploy to confirm nothing is
 * missing, without opening five separate `typeorm migration:show` runs.
 *
 * TypeORM records applied migrations in a `migrations` table inside each
 * schema; "pending" = migration files on disk under
 * apps/<service>/src/migrations that have no matching row there.
 */
import 'dotenv/config';
import { Client } from 'pg';
import { readdirSync } from 'fs';
import { resolve } from 'path';
import chalk from 'chalk';
import { MIGRATABLE_SERVICES } from './service-registry';

interface StatusRow {
  service: string;
  schema: string;
  filesOnDisk: number;
  appliedInDb: number;
  pending: number;
}

async function checkService(client: Client, appDir: string, schema: string): Promise<StatusRow> {
  const migrationsDir = resolve(__dirname, '../../apps', appDir, 'src/migrations');

  let filesOnDisk = 0;
  try {
    filesOnDisk = readdirSync(migrationsDir).filter((f) => f.endsWith('.ts')).length;
  } catch {
    filesOnDisk = 0; // migrations dir doesn't exist yet - fine for a freshly scaffolded service
  }

  let appliedInDb = 0;
  try {
    const res = await client.query(
      `SELECT count(*)::int AS count FROM "${schema}".migrations`,
    );
    appliedInDb = res.rows[0]?.count ?? 0;
  } catch {
    appliedInDb = 0; // schema/table doesn't exist yet - means zero migrations have ever run
  }

  return {
    service: appDir,
    schema,
    filesOnDisk,
    appliedInDb,
    pending: Math.max(0, filesOnDisk - appliedInDb),
  };
}

async function main() {
  const client = new Client({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USERNAME ?? 'saganova',
    password: process.env.DB_PASSWORD ?? 'saganova',
    database: process.env.DB_NAME ?? 'saganova',
  });
  await client.connect();

  const rows: StatusRow[] = [];
  for (const service of MIGRATABLE_SERVICES) {
    rows.push(await checkService(client, service.appDir, service.schema));
  }
  await client.end();

  console.log(chalk.cyan('\nMigration status across all services:\n'));
  console.log(
    'SERVICE'.padEnd(24) + 'SCHEMA'.padEnd(22) + 'ON DISK'.padEnd(10) + 'APPLIED'.padEnd(10) + 'PENDING',
  );
  console.log('-'.repeat(76));

  let anyPending = false;
  for (const r of rows) {
    const pendingLabel = r.pending > 0 ? chalk.red(String(r.pending)) : chalk.green('0');
    if (r.pending > 0) anyPending = true;
    console.log(
      r.service.padEnd(24) + r.schema.padEnd(22) + String(r.filesOnDisk).padEnd(10) + String(r.appliedInDb).padEnd(10) + pendingLabel,
    );
  }

  console.log('');
  if (anyPending) {
    console.log(chalk.yellow('⚠️  Pending migrations found. Run: npm run --workspace=@saganova/tools migrate:run-all'));
    process.exitCode = 1;
  } else {
    console.log(chalk.green('✅ Every service is fully migrated.'));
  }
}

main().catch((err) => {
  console.error(chalk.red('Status check failed:'), err);
  process.exit(1);
});
